// controllers/paymentController.ts
import { Request, Response } from 'express';
import { preference, payment } from '../utils/mercadopago';
import Order, { PaymentStatus, OrderStatus } from '../models/Order';
import Product from '../models/Product';
import mongoose from 'mongoose';
import { OrderEmail } from '../emails/OrderEmail';

export class WebhookController {
    static async handleWebHookMercadoPago(req: Request, res: Response) {
        const session = await mongoose.startSession();

        try {
            const event = req.body;
            if (event.type !== 'payment' || !event.data?.id) {
                res.status(400).json({ message: 'Evento no manejado' });
                return;
            }

            const paymentId = event.data.id;

            let paymentData;
            try {
                paymentData = await payment.get({ id: paymentId });
            } catch (mpError) {
                console.error('❌ Error al obtener el pago desde Mercado Pago:', mpError);

                if (mpError?.status === 404) {
                    res.status(404).json({ message: 'Pago no encontrado en Mercado Pago' });
                    return;
                } else {
                    res.status(500).json({ message: 'Error al obtener información del pago' });
                    return;
                }
            }

            if (!paymentData) {
                res.status(404).json({ message: 'Pago no encontrado' });
                return;
            }

            const { status, external_reference } = paymentData;
            const orderId = external_reference; // En el external_reference se guarda el orderId


            if (!orderId) {
                res.status(400).json({ message: 'order_id no encontrado en metadata' });
                return;
            }

            session.startTransaction();

            const order = await Order.findById(orderId)
                .populate('items.productId')
                .populate('user')
                .session(session);

            if (!order) {
                await session.abortTransaction();
                res.status(404).json({ message: 'Orden no encontrada' });
                return;
            }

            if (order.paymentStatus === PaymentStatus.PAGADO) {
                await session.abortTransaction();
                res.status(400).json({ message: 'La orden ya ha sido procesada' });
                return;
            }

            if (status === 'approved') {
                // Descontar stock
                for (const item of order.items) {
                    const product = await Product.findById(item.productId._id).session(session);
                    if (!product) {
                        await session.abortTransaction();
                        res.status(404).json({ message: `Producto no encontrado: ${item.productId._id}` });
                        return;
                    }

                    if (product.stock < item.quantity) {
                        await session.abortTransaction();
                        res.status(400).json({ message: `Stock insuficiente para: ${product.nombre}` });
                        return;
                    }

                    product.stock -= item.quantity;
                    await product.save({ session });
                }

                order.paymentStatus = PaymentStatus.PAGADO;
                order.status = OrderStatus.PROCESANDO;
                order.paymentId = paymentId;
                order.statusHistory.push({ status: order.status, changedAt: new Date() });

                await order.save({ session });
                await session.commitTransaction();
                session.endSession();

                // Enviar email
                const user = order.user as any;
                if (user?.email) {
                    const productos = order.items.map((item) => {
                        const producto = item.productId as any;
                        return {
                            nombre: producto?.nombre || 'Producto',
                            quantity: item.quantity
                        };
                    });

                    await OrderEmail.sendOrderConfirmationEmail({
                        email: user.email,
                        name: user.nombre,
                        orderId: order._id.toString(),
                        totalPrice: order.totalPrice,
                        shippingMethod: order.shippingMethod,
                        items: productos
                    });
                }

                console.log(`✅ Pago aprobado y orden procesada: ${orderId}`);
                res.status(200).json({ message: 'Pago aprobado y orden procesada' });
                return;

            } else if (status === 'pending') {
                order.paymentStatus = PaymentStatus.PENDIENTE;
                order.status = OrderStatus.PENDIENTE;
                order.paymentId = paymentId;
                order.statusHistory.push({ status: order.status, changedAt: new Date() });

                await order.save({ session });
                await session.commitTransaction();
                session.endSession();

                console.log(`🕐 Pago pendiente registrado para la orden: ${orderId}`);
                res.status(200).json({ message: 'Pago pendiente registrado' });
                return;

            } else if (status === 'rejected') {
                order.paymentStatus = PaymentStatus.CANCELADO;
                order.status = OrderStatus.CANCELADO;
                order.paymentId = paymentId;
                order.statusHistory.push({ status: order.status, changedAt: new Date() });

                await order.save({ session });
                await session.commitTransaction();
                session.endSession();

                console.log(`❌ Pago rechazado para la orden: ${orderId}`);
                res.status(200).json({ message: 'Pago rechazado registrado' });
                return;
            } else {
                await session.abortTransaction();
                session.endSession();
                res.status(400).json({ message: `Estado de pago no manejado: ${status}` });
                return;
            }

        } catch (error) {
            if (session.inTransaction()) await session.abortTransaction();
            session.endSession();
            console.error('❌ Error en Webhook de Mercado Pago:', error);
            res.status(500).json({ message: 'Error interno del servidor' });
            return;
        }
    }
}