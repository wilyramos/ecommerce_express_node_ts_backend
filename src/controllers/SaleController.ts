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
            const { customer, employee, items, totalDiscountAmount = 0, source, status = 'COMPLETADA', paymentMethod, paymentStatus = 'PAGADO', order } = req.body;

            const validatedItems = [];

            for (const item of items) {
                const product = await Product.findById(item.product).session(session);
                if (!product) throw new Error(`Producto no encontrado: ${item.product}`);
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
                customer,
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

            // Filtro por nombre de cliente
            if (search && typeof search === 'string') {
                query['customer.name'] = { $regex: search, $options: 'i' };
            }

            // Filtro por fechas
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

            // Paginación
            const pageNumber = parseInt(page as string, 10);
            const limitNumber = parseInt(limit as string, 10);
            const skip = (pageNumber - 1) * limitNumber;

            // Obtener ventas con paginación y filtros
            const [sales, totalSales] = await Promise.all([
                Sale.find(query)
                    .populate({
                        path: 'items.product',
                        select: 'nombre' + ' imagenes'
                    })
                    .populate({
                        path: 'customer',
                        select: 'nombre'
                    })
                    .populate({
                        path: 'employee',
                        select: 'nombre',
                    })
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limitNumber)
                    .lean(),
                Sale.countDocuments(query),
            ]);
            res.json({
                sales,
                totalSales,
                currentPage: pageNumber,
                totalPages: Math.ceil(totalSales / limitNumber)
            });
        } catch (error) {
            res.status(500).json({ message: `Error al obtener las ventas: ${error.message}` });
            return;
        }
    }
}