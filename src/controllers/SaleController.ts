import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Sale } from '../models/Sale';
import Product from '../models/Product';
import { startOfDay, endOfDay, parseISO, differenceInDays } from 'date-fns';


export class SaleController {

    static async createSale(req: Request, res: Response) {

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { customerDNI, employee, items, totalDiscountAmount = 0, source, status = 'COMPLETADA', paymentMethod, paymentStatus = 'PAGADO', order } = req.body;

            console.log("Creating sale with data:", {
                customerDNI,
                employee,
                items,
                totalDiscountAmount,
                source,
                status,
                paymentMethod,
                paymentStatus,
                order
            });

            const validatedItems = [];

            for (const item of items) {
                const product = await Product.findById(item.productId).session(session);
                if (!product) throw new Error(`Producto no encontrado: ${item.productId}`);
                if (product.stock < item.quantity) throw new Error(`Stock insuficiente: ${product.nombre}`);

                validatedItems.push({
                    product: product._id,
                    quantity: item.quantity,
                    price: product.precio,
                    costo: product.costo // Asumiendo que el modelo de producto tiene un campo costo
                });

                product.stock -= item.quantity;
                await product.save({ session });
            }

            const sale = new Sale({
                customerDNI,
                employee,
                items: validatedItems,
                totalDiscountAmount,
                source,
                status,
                paymentMethod,
                paymentStatus,
                order
            });

            await sale.save({ session });
            await session.commitTransaction();

            res.status(201).json({ message: 'Venta creada correctamente' });
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
                                    { $ifNull: ["$items.costo", "$items.price"] }  // Usa costo si existe, si no, el mismo precio
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
}
