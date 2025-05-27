import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Sale } from '../models/Sale';
import Product from '../models/Product';

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

            res.status(201).json({ message: 'Venta creada correctamente', sale });
        } catch (error) {
            await session.abortTransaction();
            res.status(500).json({ message: `Error al crear la venta: ${error.message}` });
        } finally {
            session.endSession();
        }
    }

    //TODO:
    static async getSales(req: Request, res: Response) {
        try {
            const { customer, employee, source, status, paymentMethod, paymentStatus } = req.query;

            const filter: any = {};

            if (customer) filter.customer = customer;
            if (employee) filter.employee = employee;
            if (source) filter.source = source;
            if (status) filter.status = status;
            if (paymentMethod) filter.paymentMethod = paymentMethod;
            if (paymentStatus) filter.paymentStatus = paymentStatus;

            const sales = await Sale.find(filter)
                .populate('customer', 'nombre email')
                .populate('employee', 'nombre email')
                .populate('items.product', 'nombre precio');

            res.status(200).json(sales);
        } catch (error) {
            res.status(500).json({ message: `Error al obtener las ventas: ${error.message}` });
        }
    }
}