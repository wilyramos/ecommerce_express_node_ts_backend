import Order from '../models/Order';
import { Request, Response } from 'express';

export class OrderController {
    static async createOrder(req: Request, res: Response) {
        try {
            const userId = req.user?._id || null; // usuario autenticado o null

            const orderData = req.body;

            const generateTrackingId = () => {
                const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                let trackingId = '';
                for (let i = 0; i < 10; i++) {
                    trackingId += characters.charAt(Math.floor(Math.random() * characters.length));
                }
                return trackingId;
            }

            const newOrder = new Order({
                user: userId,   
                items: orderData.items,
                totalPrice: orderData.totalPrice,
                shippingAddress: orderData.shippingAddress,
                paymentMethod: orderData.paymentMethod,
                paymentStatus: orderData.paymentStatus,
                trackingId: generateTrackingId(),
            });

            await newOrder.save();
            res.status(201).json({ message: 'Orden creada exitosamente' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Error al crear la orden' });
        }
    }

    static async getOrders(req: Request, res: Response) {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;

            const skip = (page - 1) * limit;

            const orders = await Order.find()
                .skip(skip)
                .limit(limit)
                .populate('user', 'name email') // Populate user details
                .sort({ createdAt: -1 }); // Sort by creation date

            const totalOrders = await Order.countDocuments();

            console.log("Orders:", orders);

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
}