import Order, { OrderStatus, PaymentStatus } from '../models/Order';
import { Request, Response } from 'express';
import { OrderEmail } from '../emails/OrderEmail';
import mongoose from 'mongoose';
import Product from '../models/Product';


export class OrderController {

    static async createOrder(req: Request, res: Response) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const {
                items,
                subtotal,
                shippingCost,
                totalPrice,
                shippingAddress,
                paymentMethod,
                transactionId,
                payment,
                rawPaymentResponse,
                currency = 'PEN'
            } = req.body;

            if (!items || !Array.isArray(items) || items.length === 0) {
                res.status(400).json({ message: 'La orden debe tener al menos un producto' });
                return;
            }

            if (!payment?.provider) {
                res.status(400).json({ message: 'Proveedor de pago requerido' });
                return;
            }

            // Validar que los productos existan y precios no hayan cambiado
            const productIds = items.map(i => i.productId);
            const dbProducts = await Product.find({ _id: { $in: productIds } }).session(session);

            if (dbProducts.length !== items.length) {
                res.status(400).json({ message: 'Uno o más productos no existen' });
                return;
            }

            let calculatedSubtotal = 0;
            for (const item of items) {
                const dbProduct = dbProducts.find(p => p._id.toString() === item.productId);
                if (!dbProduct) continue;

                if (item.price !== dbProduct.precio) {
                    res.status(400).json({
                        message: `El precio del producto "${dbProduct.nombre}" ha cambiado`
                    });
                    return;
                }

                calculatedSubtotal += item.price * item.quantity;
            }

            if (calculatedSubtotal !== subtotal) {
                res.status(400).json({ message: 'El subtotal no coincide' });
                return;
            }

            if (subtotal + shippingCost !== totalPrice) {
                res.status(400).json({ message: 'El total no coincide' });
                return;
            }

            // Generar número de orden único
            const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

            const newOrder = await Order.create([{
                orderNumber,
                user: req.user._id,
                items: items.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    price: item.price
                })),
                subtotal,
                shippingCost,
                totalPrice,
                currency,
                status: OrderStatus.AWAITING_PAYMENT,
                statusHistory: [{
                    status: OrderStatus.AWAITING_PAYMENT,
                    changedAt: new Date()
                }],
                shippingAddress,
                payment: {
                    provider: payment.provider,
                    method: paymentMethod,
                    transactionId,
                    status: payment.status || PaymentStatus.PENDING,
                    rawResponse: rawPaymentResponse
                }
            }], { session });

            await session.commitTransaction();

            res.status(201).json({
                message: 'Orden creada exitosamente',
                order: newOrder[0]
            });
            return;

        } catch (error) {
            await session.abortTransaction();
            console.error('Error al crear la orden:', error);
            res.status(500).json({ message: 'Error al crear la orden' });
            return;
        } finally {
            session.endSession();
            return;
        }
    }


    // Trear todas las orders para el administrador
    static async getOrders(req: Request, res: Response) {
        try {

            // TODO: query
            const page = parseInt(req.query.page as string) || 1;
            let limit = parseInt(req.query.limit as string) || 10;
            const pedido = req.query.pedido as string || '';
            const fecha = req.query.fecha as string || '';
            const estadoPago = req.query.estadoPago as string || '';
            const estadoEnvio = req.query.estadoEnvio as string || '';

            if (limit > 50) {
                limit = 50; // Limitar a un máximo de 50
            }
            const skip = (page - 1) * limit;
            const searchConditions: any = {};

            if (pedido) {
                searchConditions.$or = [
                    { orderNumber: { $regex: pedido, $options: "i" } },
                    { _id: { $regex: pedido, $options: "i" } },
                ];
            }

            if (fecha) {
                searchConditions.createdAt = { $gte: new Date(fecha), $lt: new Date(fecha + 'T23:59:59') };
            }

            if (estadoPago) {
                searchConditions.paymentStatus = estadoPago;
            }

            if (estadoEnvio) {
                searchConditions.status = estadoEnvio;
            }

            const orders = await Order.find(searchConditions)
                .sort({ createdAt: -1 }) // Ordenar
                .skip(skip)
                .limit(limit)

            const totalOrders = await Order.countDocuments(searchConditions);

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
                res.status(400).json({ message: 'Datos incompletos para crear la orden' });
                return;
            }

            const totalOrders = await Order.countDocuments();
            const orderNumber = `ORD-${totalOrders + 1}`; // Generar un número de orden único

            // Crear la orden
            const newOrder = new Order({
                orderNumber,
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