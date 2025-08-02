import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Sale } from '../models/Sale';
import Product from '../models/Product';
import { startOfDay, endOfDay, parseISO } from 'date-fns';


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
                    price: product.precio
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
}