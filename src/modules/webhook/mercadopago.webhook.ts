// File: backend/src/modules/webhook/mercadopago.webhook.ts

import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { payment } from '../../utils/mercadopago';
import Order, { PaymentStatus, OrderStatus } from '../../models/Order';
import { OrderEmail } from '../../emails/OrderEmailResend';
import { deductStock } from './deductStock';

export async function handleWebhookMercadoPago(req: Request, res: Response): Promise<void> {
    const session = await mongoose.startSession();

    try {
        const event = req.body;

        if (event.type !== 'payment' || !event.data?.id) {
            res.status(400).json({ message: 'Evento no manejado' });
            return;
        }

        const paymentId = String(event.data.id);

        // ── 1. Obtener datos del pago desde MP ────────────────────────────────
        let paymentData: Awaited<ReturnType<typeof payment.get>>;
        try {
            paymentData = await payment.get({ id: paymentId });
        } catch (mpError: any) {
            console.error('❌ [MP] Error al obtener el pago:', mpError);
            const httpStatus = mpError?.status === 404 ? 404 : 500;
            res.status(httpStatus).json({ message: 'Error al obtener información del pago' });
            return;
        }

        if (!paymentData) {
            res.status(404).json({ message: 'Pago no encontrado en Mercado Pago' });
            return;
        }

        const { status, external_reference: orderId } = paymentData;

        if (!orderId) {
            res.status(400).json({ message: 'external_reference (orderId) ausente en el pago' });
            return;
        }

        // ── 2. Cargar orden ───────────────────────────────────────────────────
        session.startTransaction();

        const order = await Order.findById(orderId)
            .populate<{ user: { email: string; nombre: string } }>('user', 'email nombre')
            .session(session);

        if (!order) {
            await session.abortTransaction();
            session.endSession();
            res.status(404).json({ message: 'Orden no encontrada' });
            return;
        }

        // Idempotencia: ignorar si el pago ya fue aprobado
        if (order.payment?.status === PaymentStatus.APPROVED) {
            await session.abortTransaction();
            session.endSession();
            res.status(200).json({ message: 'Orden ya procesada anteriormente' });
            return;
        }

        // ── 3. Procesar según estado del pago ─────────────────────────────────

        if (status === 'approved') {
            // Intentar descontar stock — devuelve resultado en lugar de lanzar
            const stockResult = await deductStock(order.items, session);

            // El pago siempre se registra como APPROVED (el dinero ya fue cobrado)
            order.payment = {
                provider: 'mercadopago',
                transactionId: paymentId,
                status: PaymentStatus.APPROVED,
                rawResponse: paymentData,
            };

            if (stockResult.success) {
                order.status = OrderStatus.PROCESSING;
                order.statusHistory.push({ status: OrderStatus.PROCESSING, changedAt: new Date() });
                console.log(`✅ [MP] Orden ${orderId} → PROCESSING`);
            } else {
                // Pago cobrado pero uno o más ítems sin stock suficiente
                order.status = OrderStatus.PAID_BUT_OUT_OF_STOCK;
                order.statusHistory.push({
                    status: OrderStatus.PAID_BUT_OUT_OF_STOCK,
                    changedAt: new Date(),
                });
                console.warn(
                    `⚠️ [MP] Orden ${orderId} → PAID_BUT_OUT_OF_STOCK. ` +
                    `Ítems sin stock: ${stockResult.outOfStockItems.join(', ')}`
                );
            }

            await order.save({ session });
            await session.commitTransaction();
            session.endSession();

            // Email fuera de la transacción (fallo de correo no debe revertir el pago)
            const user = order.user as any;
            const emailTarget = user?.email ?? order.customerProfile.email;
            const nameTarget = user?.nombre ?? order.customerProfile.nombre;

            if (emailTarget) {
                OrderEmail.sendOrderConfirmationEmail({
                    email: emailTarget,
                    name: nameTarget,
                    orderId: order.orderNumber, // FIX: era order._id, debe ser el número comercial
                    totalPrice: order.totalPrice,
                    shippingMethod: order.shippingAddress.direccion,
                    items: order.items.map((item: any) => item.toObject()),
                }).catch((err) => console.error('⚠️ [MP] Error enviando email:', err));
            }

            res.status(200).json({ message: 'Pago aprobado y orden procesada' });

        } else if (status === 'pending') {
            order.payment = {
                provider: 'mercadopago',
                transactionId: paymentId,
                status: PaymentStatus.PENDING,
                rawResponse: paymentData,
            };
            order.status = OrderStatus.AWAITING_PAYMENT;
            order.statusHistory.push({
                status: OrderStatus.AWAITING_PAYMENT,
                changedAt: new Date(),
            });

            await order.save({ session });
            await session.commitTransaction();
            session.endSession();

            console.log(`🕐 [MP] Pago pendiente para orden ${orderId}`);
            res.status(200).json({ message: 'Pago pendiente registrado' });

        } else if (status === 'rejected') {
            order.payment = {
                provider: 'mercadopago',
                transactionId: paymentId,
                status: PaymentStatus.REJECTED,
                rawResponse: paymentData,
            };
            order.status = OrderStatus.CANCELED;
            order.statusHistory.push({ status: OrderStatus.CANCELED, changedAt: new Date() });

            await order.save({ session });
            await session.commitTransaction();
            session.endSession();

            console.log(`❌ [MP] Pago rechazado para orden ${orderId}`);
            res.status(200).json({ message: 'Pago rechazado registrado' });

        } else {
            await session.abortTransaction();
            session.endSession();
            console.log(`ℹ️ [MP] Estado de pago no manejado: ${status}`);
            res.status(200).json({ message: `Estado de pago "${status}" no requiere acción` });
        }

    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        session.endSession();
        console.error('❌ [MP] Error en webhook:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
}