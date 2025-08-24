import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Sale } from '../models/Sale';
import Product from '../models/Product';
import { startOfDay, endOfDay, parseISO, differenceInDays } from 'date-fns';
import { SaleStatus, PaymentMethod } from '../models/Sale';
import PDFDocument from "pdfkit";
import { generateSalePDF } from '../utils/generateTicket';


export class SaleController {

    static async createSale(req: Request, res: Response) {

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const {
                customerId,
                customerSnapshot,
                employee,
                items,
                totalDiscountAmount = 0,
                status = SaleStatus.COMPLETED,
                paymentMethod = PaymentMethod.CASH,
                paymentStatus = 'APPROVED',
                deliveryMethod = 'PICKUP',
                storeLocation,
                receiptType = 'TICKET',
                receiptNumber,
            } = req.body;


            const validatedItems = [];

            for (const item of items) {
                const product = await Product.findById(item.product).session(session);
                if (!product) throw new Error(`Producto no encontrado: ${item.product}`);
                if (product.stock < item.quantity) throw new Error(`Stock insuficiente para: ${product.nombre}`);

                validatedItems.push({
                    product: product._id,
                    quantity: item.quantity,
                    price: product.precio,
                    cost: product.costo
                });

                product.stock -= item.quantity;
                await product.save({ session });
            };

            const totalPrice = validatedItems.reduce((sum, item) => sum + item.price * item.quantity, 0) - totalDiscountAmount;

            const sale = new Sale({
                customer: customerId || undefined,
                customerSnapshot: customerSnapshot || undefined,
                employee,
                items: validatedItems,
                totalPrice,
                totalDiscountAmount,
                receiptType,
                receiptNumber,
                status,
                paymentMethod,
                paymentStatus,
                deliveryMethod,
                storeLocation
            });

            await sale.save({ session });
            await session.commitTransaction();

            res.status(201).json({
                message: 'Venta creada correctamente',
                saleId: sale._id
            });
        } catch (error) {
            await session.abortTransaction();
            res.status(500).json({ message: `Error al crear la venta: ${error.message}` });
            return;
        } finally {
            session.endSession();
        }
    }

    static async getSales(req: Request, res: Response) {
        try {
            const { search, fechaInicio, fechaFin, page = '1', limit = '10' } = req.query;

            const query: any = {};

            // Filtro por DNI
            if (search && typeof search === 'string') {
                query.customerDNI = search;
            }

            // Filtro por rango de fechas
            if (fechaInicio || fechaFin) {
                query.createdAt = {};
                if (fechaInicio && typeof fechaInicio === 'string') {
                    const inicio = startOfDay(parseISO(fechaInicio));
                    query.createdAt.$gte = inicio;
                }
                if (fechaFin && typeof fechaFin === 'string') {
                    const fin = endOfDay(parseISO(fechaFin));
                    query.createdAt.$lte = fin;
                }
            }

            const pageNumber = parseInt(page as string, 10);
            const limitNumber = parseInt(limit as string, 10);
            const skip = (pageNumber - 1) * limitNumber;

            const [sales, totalSales, totalAmountResult] = await Promise.all([
                Sale.find(query)
                    // .populate({ path: 'items.product', select: 'nombre imagenes' })
                    .populate({ path: 'employee', select: 'nombre' })
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limitNumber)
                    .lean(),

                Sale.countDocuments(query),

                // Agregación para calcular el total vendido
                Sale.aggregate([
                    { $match: query },
                    {
                        $group: {
                            _id: null,
                            totalAmount: { $sum: "$totalPrice" },
                        },
                    },
                ]),
            ]);

            const totalAmount = totalAmountResult.length > 0 ? totalAmountResult[0].totalAmount : 0;

            res.json({
                sales,
                totalSales,
                totalAmount, // <- total de dinero vendido
                currentPage: pageNumber,
                totalPages: Math.ceil(totalSales / limitNumber),
            });
        } catch (error) {
            res.status(500).json({ message: `Error al obtener las ventas: ${error.message}` });
        }
    }

    static async getSalesReport(req: Request, res: Response) {
        try {
            const { fechaInicio, fechaFin } = req.query;

            if (!fechaInicio || !fechaFin || typeof fechaInicio !== 'string' || typeof fechaFin !== 'string') {
                res.status(400).json({ message: 'Debe proporcionar fechaInicio y fechaFin válidas' });
                return;
            }

            const startDate = startOfDay(parseISO(fechaInicio));
            const endDate = endOfDay(parseISO(fechaFin));
            const diffDays = differenceInDays(endDate, startDate);
            // Agrupación por día o por mes
            const dateFormat = diffDays <= 31 ? "%Y-%m-%d" : "%Y-%m";

            const report = await Sale.aggregate([
                {
                    $match: {
                        createdAt: {
                            $gte: startDate,
                            $lte: endDate
                        }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: dateFormat,
                                date: "$createdAt"
                            }
                        },
                        ventas: { $sum: "$totalPrice" },
                        cantidadVentas: { $sum: 1 },
                        unidadesVendidas: { $sum: { $sum: "$items.quantity" } },
                    }
                },
                {
                    $project: {
                        label: "$_id",
                        ventas: 1,
                        cantidadVentas: 1,
                        unidadesVendidas: 1,
                        _id: 0
                    }
                },
                { $sort: { label: 1 } }
            ]);

            res.json({ report });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: `Error al generar el reporte: ${error.message}` });
            return;
        }
    }

    static async getSalesSummary(req: Request, res: Response) {
        try {
            const { fechaInicio, fechaFin } = req.query;

            if (!fechaInicio || !fechaFin || typeof fechaInicio !== 'string' || typeof fechaFin !== 'string') {
                res.status(400).json({ message: 'Debe proporcionar fechaInicio y fechaFin válidas' });
                return;
            }

            const startDate = startOfDay(parseISO(fechaInicio));
            const endDate = endOfDay(parseISO(fechaFin));

            const [salesTotals] = await Sale.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate, $lte: endDate }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalSales: { $sum: "$totalPrice" },
                        numberSales: { $sum: 1 }
                    }
                }
            ]);

            const [costTotals] = await Sale.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate, $lte: endDate }
                    }
                },
                { $unwind: "$items" },
                {
                    $group: {
                        _id: null,
                        totalUnitsSold: { $sum: "$items.quantity" },
                        totalCost: {
                            $sum: {
                                $multiply: [
                                    "$items.quantity",
                                    { $ifNull: ["$items.cost", "$items.price"] }  // Usa costo si existe, si no, el mismo precio
                                ]
                            }
                        }
                    }
                }
            ]);

            // Combinar ambos resultados
            const summary = {
                totalSales: salesTotals?.totalSales || 0,
                numberSales: salesTotals?.numberSales || 0,
                totalUnitsSold: costTotals?.totalUnitsSold || 0,
                margin: (salesTotals?.totalSales || 0) - (costTotals?.totalCost || 0)
            };

            res.json({ summary });
            return;
        } catch (error) {
            console.error("Error al obtener el resumen de ventas:", error);
            res.status(500).json({ message: `Error al obtener el resumen de ventas: ${error.message}` });
            return;
        }
    }

    // para obtener top de productos mas vendidos

    static async getTopProducts(req: Request, res: Response) {
        try {
            const { fechaInicio, fechaFin, limit = 10 } = req.query;

            if (!fechaInicio || !fechaFin || typeof fechaInicio !== 'string' || typeof fechaFin !== 'string') {
                res.status(400).json({ message: 'Debe proporcionar fechaInicio y fechaFin válidas' });
                return;
            }

            const startDate = startOfDay(parseISO(fechaInicio));
            const endDate = endOfDay(parseISO(fechaFin));

            const topProducts = await Sale.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate, $lte: endDate },
                        status: "COMPLETED" // solo ventas completadas
                    }
                },
                { $unwind: "$items" },
                {
                    $group: {
                        _id: "$items.product", // ahora usamos items.product (ObjectId de Product)
                        totalQuantity: { $sum: "$items.quantity" },
                        totalSales: { $sum: { $multiply: ["$items.quantity", "$items.price"] } },
                        totalCost: { $sum: { $multiply: ["$items.quantity", "$items.cost"] } }
                    }
                },
                {
                    $addFields: {
                        margin: { $subtract: ["$totalSales", "$totalCost"] }
                    }
                },
                {
                    $lookup: {
                        from: "products", // nombre de la colección de productos en MongoDB
                        localField: "_id",
                        foreignField: "_id",
                        as: "product"
                    }
                },
                { $unwind: "$product" },
                {
                    $project: {
                        _id: 0,
                        productId: "$_id",
                        nombre: "$product.nombre", // ajusta al campo real de tu Product
                        totalQuantity: 1,
                        totalSales: 1,
                        margin: 1
                    }
                },
                { $sort: { totalQuantity: -1 } }, // Ordenar por cantidad vendida
                { $limit: Number(limit) }
            ]);

            res.json({ topProducts });
            return;
        } catch (error) {
            console.error("Error al obtener los productos más vendidos:", error);
            res.status(500).json({ message: `Error al obtener los productos más vendidos: ${error.message}` });
            return;
        }
    }

    static async getReportByVendors(req: Request, res: Response) {
        try {
            const { fechaInicio, fechaFin } = req.query;

            if (!fechaInicio || !fechaFin || typeof fechaInicio !== 'string' || typeof fechaFin !== 'string') {
                res.status(400).json({ message: 'Debe proporcionar fechaInicio y fechaFin válidas' });
                return;
            }

            const startDate = startOfDay(parseISO(fechaInicio));
            const endDate = endOfDay(parseISO(fechaFin));

            const report = await Sale.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate, $lte: endDate },
                        status: "COMPLETED"
                    }
                },
                // Desglosamos items para contar unidades
                { $unwind: "$items" },
                {
                    $group: {
                        _id: "$employee", // agrupamos por vendedor
                        totalUnits: { $sum: "$items.quantity" },
                        totalSales: { $sum: { $multiply: ["$items.quantity", "$items.price"] } },
                        totalCost: { $sum: { $multiply: ["$items.quantity", "$items.cost"] } },
                        // número de ventas únicas (facturas) → usamos $addToSet
                        salesSet: { $addToSet: "$_id" }
                    }
                },
                {
                    $addFields: {
                        numSales: { $size: "$salesSet" }, // cantidad de ventas únicas
                        margin: { $subtract: ["$totalSales", "$totalCost"] }
                    }
                },
                {
                    $lookup: {
                        from: "users", // colección de empleados
                        localField: "_id",
                        foreignField: "_id",
                        as: "employee"
                    }
                },
                { $unwind: "$employee" },
                {
                    $project: {
                        _id: 0,
                        employeeId: "$_id",
                        nombre: "$employee.nombre", // ajusta según tu User model
                        numSales: 1,
                        totalUnits: 1,
                        totalSales: 1,
                        margin: 1
                    }
                },
                { $sort: { totalSales: -1 } },
            ]);

            res.json({ report });
            return;

        } catch (error) {

        }
    }

    static async getSalePdf(req: Request, res: Response) {
        const saleId = req.params.id;

        try {
            const sale = await Sale.findById(saleId).populate("items.product");

            if (!sale) {
                res.status(404).json({ message: "Venta no encontrada" });
                return;
            }

            const doc = new PDFDocument({ size: "A4", margin: 40 });
            let buffers: Buffer[] = [];

            doc.on("data", buffers.push.bind(buffers));
            doc.on("end", () => {
                const pdfData = Buffer.concat(buffers);
                res.setHeader("Content-Type", "application/pdf");
                res.setHeader(
                    "Content-Disposition",
                    `attachment; filename="${sale.receiptType}-${saleId}.pdf"`
                );
                res.send(pdfData);
            });

            // Genera el PDF según tipo
            generateSalePDF(doc, sale);

            doc.end();
        } catch (error) {
            console.error("Error al generar PDF:", error);
            res.status(500).json({ message: "Error al generar PDF" });
            return;
        }
    }
}