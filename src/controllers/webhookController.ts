// controllers/paymentController.ts
import { Request, Response } from 'express';
import { preference, payment } from '../utils/mercadopago';
import Order, { PaymentStatus, OrderStatus } from '../models/Order';
import Product from '../models/Product';
import mongoose from 'mongoose';
import { OrderEmail } from '../emails/OrderEmail';

export class WebhookController {

    static async handleWebHookMercadoPago(req: Request, res: Response) {

        // Para hacer la trasaccion de la orden
        const session = await mongoose.startSession();

        try {
            const event = req.body;

            if (event.type === 'payment' && event.data?.id) {
                const paymentId = event.data.id;
                const paymentData = await payment.get({ id: paymentId });

                if (!paymentData) {
                    res.status(404).json({ message: 'Pago no encontrado' });
                    return;
                }

                const { status, metadata } = paymentData;

                const orderId = metadata?.order_id;
                if (!orderId) {
                    res.status(400).json({ message: 'order_id no encontrado en metadata' });
                    return;
                }

                // Iniciar transacción
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

                // Evitar procesar la orden si ya ha sido pagada
                if (order.paymentStatus === PaymentStatus.PAGADO) {
                    await session.abortTransaction();
                    res.status(400).json({ message: 'La orden ya ha sido procesada' });
                    return;
                }

                // Descontar el stock de los productos
                for (const item of order.items) {
                    const product = await Product.findById(item.productId._id).session(session);
                    if (!product) {
                        await session.abortTransaction();
                        res.status(404).json({ message: `Producto no encontrado: ${item.productId._id}` });
                        return;
                    }

                    if (product.stock < item.quantity) {
                        await session.abortTransaction();
                        res.status(400).json({ message: `Stock insuficiente para el producto: ${product.nombre}` });
                        return;
                    }

                    product.stock -= item.quantity;
                    await product.save({ session });
                }

                // Actualizar el estado de la orden
                order.paymentStatus = status === "approved" ? PaymentStatus.PAGADO : PaymentStatus.PENDIENTE;
                order.status = status === "approved" ? OrderStatus.PROCESANDO : OrderStatus.PENDIENTE;
                order.paymentId = paymentId;
                order.statusHistory.push({
                    status: order.status,
                    changedAt: new Date()
                });

                await order.save({ session });
                await session.commitTransaction();

                session.endSession();

                // Enviar email de confirmación
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

                console.log(`✅ Webhook de Mercado Pago procesado correctamente para el pago ${paymentId} y la orden ${orderId}`);

                res.status(200).json({ message: 'Webhook procesado correctamente' });
                return;
            }

            res.status(400).json({ message: 'Evento no manejado' });
            return;


        } catch (error) {
            if (session.inTransaction()) {
                // Si hay un error, abortar la transacción
                await session.abortTransaction();
            }
            session.endSession();
            console.error('❌ Error al procesar el Webhook de Mercado Pago:', error);
            res.status(500).json({ message: 'Error interno del servidor' });
            return;
        }
    }
}