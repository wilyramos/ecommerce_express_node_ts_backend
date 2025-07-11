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
                items: items.map((item: any) => ({
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

    // Trear todas las orders para el administrador
    static async getOrders(req: Request, res: Response) {
        try {

            // TODO: query
            const page = parseInt(req.query.page as string) || 1;
            let limit = parseInt(req.query.limit as string) || 10;
            const query = req.query.query as string || '';
            const skip = (page - 1) * limit;

            // limit a maximo 50
            if (limit > 50) {
                limit = 50;
            }


            const orders = await Order.find({})
                .sort({ createdAt: -1 }) // Ordenar
                .skip(skip)
                .limit(limit)

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
            return;
        }
    }

    static async getOrdersByUser(req: Request, res: Response) {
        try {

            const page = parseInt(req.query.page as string) || 1;
            let limit = parseInt(req.query.limit as string) || 5;
            const userId = req.user._id;

            const skip = (page - 1) * limit;

            // Limitar a maximo 50
            if (limit > 50) {
                limit = 50;
            }

            const orders = await Order.find({ user: userId })
                .sort({ createdAt: -1 }) // Ordenar por fecha de creación
                .skip(skip)
                .limit(limit)

            const totalOrders = await Order.countDocuments({ user: userId });

            res.status(200).json({
                orders,
                totalOrders,
                currentPage: page,
                totalPages: Math.ceil(totalOrders / limit),
            });
        } catch (error) {
            // console.error(error);
            res.status(500).json({ message: 'Error al obtener las órdenes del usuario' });
            return;
        }
    }


    static async getOrderById(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const userId = req.user._id;
            const rol = req.user.rol;

            const order = await Order.findById(id)
                .populate({ path: 'items.productId', select: 'nombre imagenes sku barcode' })
                .populate('user', 'nombre apellidos email') // Popula el usuario si es necesario

            if (!order) {
                res.status(404).json({ message: 'Orden no encontrada' });
                return;
            }

            if (rol !== 'administrador' && order.user._id.toString() !== userId.toString()) {
                res.status(403).json({ message: 'No tienes permiso para acceder a esta orden' });
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