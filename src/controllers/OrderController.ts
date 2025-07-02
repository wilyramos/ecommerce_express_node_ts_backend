import Order from '../models/Order';
import { Request, Response } from 'express';
import Product from '../models/Product';
import mongoose from 'mongoose';
import User from '../models/User';

export class OrderController {

    static async createOrder(req: Request, res: Response) {
        try {
            const userId = req.user?._id || req.body.userId;
            const orderData = req.body;

            const session = await mongoose.startSession();
            session.startTransaction();

            try {
                // Iterar y validar productos
                for (const item of orderData.items) {
                    const product = await Product.findById(item.product).session(session);

                    if (!product) {
                        throw new Error(`Producto no encontrado: ${item.product}`);
                    }

                    if (product.stock < item.quantity) {
                        throw new Error(`Stock insuficiente para el producto: ${product.nombre}`);
                    }

                    // Descontar stock
                    product.stock -= item.quantity;
                    await product.save({ session });
                }

                // Crear orden
                const generateTrackingId = () => {
                    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                    let trackingId = '';
                    for (let i = 0; i < 10; i++) {
                        trackingId += characters.charAt(Math.floor(Math.random() * characters.length));
                    }
                    return trackingId;
                };

                const newOrder = new Order({
                    user: userId,
                    items: orderData.items,
                    totalPrice: orderData.totalPrice,
                    shippingAddress: orderData.shippingAddress,
                    paymentMethod: orderData.paymentMethod,
                    paymentStatus: orderData.paymentStatus,
                    trackingId: generateTrackingId(),
                });

                await newOrder.save({ session });

                await session.commitTransaction();
                session.endSession();

                res.status(201).json({ message: 'Orden creada exitosamente' });

            } catch (innerError) {
                await session.abortTransaction();
                session.endSession();
                console.error(innerError);
                res.status(500).json({ message: `Error al procesar la orden: ${innerError.message}` });
                return;
            }

        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Error al crear la orden' });
        }
    }

    static async getOrders(req: Request, res: Response) {
        try {

            // TODO: query
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const query = req.query.query as string || '';
            const skip = (page - 1) * limit;

            const orders = await Order.find({
                $or: [
                    { 'user.name': { $regex: query, $options: 'i' } },
                    { 'trackingId': { $regex: query, $options: 'i' } }
                ]
            })
                .skip(skip)
                .limit(limit)
                .populate('user', 'name email') // Populate user details
                .sort({ createdAt: -1 }); // Sort by creation date

            const totalOrders = await Order.countDocuments();

            res.status(200).json({
                orders,
                totalOrders,
                currentPage: page,
                totalPages: Math.ceil(totalOrders / limit),
            });

        } catch (error) {
            // console.error(error);
            res.status(500).json({ message: 'Error al obtener las órdenes' });
        }
    }

    static async getOrderById(req: Request, res: Response) {
        try {
            const orderId = req.params.id;

            const order = await Order.findById(orderId)
                .populate('user', 'name email') // Populate user details
                .populate('items.product', 'nombre imagenes sku'); // Populate product details

            console.log(order);

            if (!order) {
                res.status(404).json({ message: 'Orden no encontrada' });
                return;
            }

            res.status(200).json(order);

        } catch (error) {
            // console.error(error);
            res.status(500).json({ message: 'Error al obtener la orden' });
            return;
        }
    }
}