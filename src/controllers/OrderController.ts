import Order from '../models/Order';
import { Request, Response } from 'express';
import Product from '../models/Product';
import mongoose from 'mongoose';
import { IOrderItem } from "../models/Order";


export class OrderController {

    static async createOrder(req: Request, res: Response) {
        try {

            // TODO: añadir session para manejar transacciones solo si la confirmación de pago es exitosa
            const {
                items,
                subtotal,
                shippingCost,
                totalPrice,
                shippingAddress,
                shippingMethod,
                notes,
            } = req.body;


            const newOrder = await Order.create({
                user: req.user._id,
                items: items.map((item : any ) => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    price: item.price,
                })),
                subtotal,
                shippingCost,
                totalPrice,
                shippingAddress,
                shippingMethod,
                paymentMethod: 'MERCADOPAGO',
                paymentStatus: 'PENDIENTE',
                status: 'PENDIENTE',
                statusHistory: [{ status: 'PENDIENTE', changedAt: new Date() }],
                notes,
            });

            res.status(201).json({
                message: 'Orden creada exitosamente',
                order: newOrder,
            });

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

    static async createOrderFromPayment(req: Request, res: Response) {
        try {
            const { userId, items, totalPrice, shippingAddress, paymentMethod, paymentStatus, trackingId } = req.body;

            // Validar que los datos necesarios estén presentes
            if (!userId || !items || !totalPrice || !shippingAddress || !paymentMethod || !paymentStatus) {
                return res.status(400).json({ message: 'Datos incompletos para crear la orden' });
            }

            // Crear la orden
            const newOrder = new Order({
                user: userId,
                items,
                totalPrice,
                shippingAddress,
                paymentMethod,
                paymentStatus,
                trackingId: trackingId || null,
            });

            await newOrder.save();

            res.status(201).json({ message: 'Orden creada exitosamente', order: newOrder });

        } catch (error) {
            console.error('❌ Error al guardar orden desde webhook:', error);
        }
    }

}