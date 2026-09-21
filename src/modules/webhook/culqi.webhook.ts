// File: backend/src/modules/webhook/culqi.webhook.ts

import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Order, { PaymentStatus, OrderStatus } from '../../models/Order';
import { OrderEmail } from '../../emails/OrderEmailResend';
import { deductStock } from './deductStock';
import { validateCulqiCharge, validateCulqiOrder } from './culqi.verify';
import { orderService } from '../order/order.service';

interface CulqiWebhookEvent {
    type: string;
    data?: any;
}
interface CulqiChargeObject {
    id: string;
    state?: string;
    outcome?: { type: string; code: string; userMessage?: string; };
    metadata?: { [key: string]: unknown };
}
interface CulqiOrderObject {
    id: string;
    state: string; 
    metadata?: { [key: string]: unknown };
}

export async function handleWebhookCulqi(req: Request, res: Response): Promise<void> {
    try {
        console.log('──────────────────────────────────────────────────');
        console.log('📥 [Culqi Webhook] NUEVO EVENTO RECIBIDO');
        const event = typeof req.body === 'object' && !(req.body instanceof Buffer)
                ? (req.body as CulqiWebhookEvent)
                : (JSON.parse((req.body as Buffer).toString('utf8')) as CulqiWebhookEvent);

        const eventType = event.type ?? '';
        const eventObject = typeof event.data === 'string' ? JSON.parse(event.data) : (event.data ?? event);

        console.log(`📦 [Culqi Webhook] Tipo de evento: ${eventType}`);
        console.log(`📦 [Culqi Webhook] ID Objeto: ${eventObject?.id}`);

        if (eventType.startsWith('charge.')) {
            if (eventType === 'charge.refunded') {
                await handleRefundEvent(eventObject as CulqiChargeObject, res);
            } else {
                await handleChargeEvent(eventObject as CulqiChargeObject, res);
            }
            return;
        }

        if (eventType.startsWith('order.')) {
            await handleOrderEvent(eventObject as CulqiOrderObject, res);
            return;
        }

        console.log(`ℹ️ [Culqi Webhook] Evento ignorado (No contemplado): ${eventType}`);
        res.status(200).json({ message: `Evento "${eventType}" no manejado` });
    } catch (error) {
        console.error('❌ [Culqi Webhook] Error inesperado en el webhook:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
}

async function handleChargeEvent(charge: CulqiChargeObject, res: Response): Promise<void> {
    const chargeId = charge.id ?? '';
    console.log(`🔍 [Culqi Webhook: Cargo] Analizando Cargo ID: ${chargeId}`);

    if (!chargeId) {
        console.warn('⚠️ [Culqi Webhook: Cargo] Payload sin charge ID — ignorado');
        res.status(200).json({ message: 'Sin charge ID en payload' });
        return;
    }

    const verified = await validateCulqiCharge(chargeId);
    if (!verified.valid) {
        console.warn(`⚠️ [Culqi Webhook: Cargo] API de Culqi NO reconoce el cargo ${chargeId}. (Posible fraude/payload falso)`);
        res.status(200).json({ message: 'Cargo no verificable en API Culqi' });
        return;
    }

    const { outcomeType, orderNumber } = verified;
    console.log(`💳 [Culqi Webhook: Cargo] Verificado Ok | outcome: ${outcomeType} | orderNumber: ${orderNumber}`);

    if (!orderNumber) {
        console.warn('⚠️ [Culqi Webhook: Cargo] No se pudo extraer orderNumber de los metadatos.');
        res.status(200).json({ message: 'Sin orderNumber identificable en el cargo' });
        return;
    }

    if (outcomeType !== 'venta_exitosa') {
        console.log(`ℹ️ [Culqi Webhook: Cargo] Transacción NO es venta_exitosa ("${outcomeType}") — Se ignora.`);
        res.status(200).json({ message: `outcome_type "${outcomeType}" no requiere acción` });
        return;
    }

    await processApprovedOrder(orderNumber, chargeId, 'culqi-cargo');
    res.status(200).json({ message: 'Cargo aprobado procesado correctamente' });
}

async function handleRefundEvent(charge: CulqiChargeObject, res: Response): Promise<void> {
    const chargeId = charge.id ?? '';
    console.log(`↩️ [Culqi Webhook: Reembolso] Analizando Reembolso para Cargo ID: ${chargeId}`);

    if (!chargeId) {
        res.status(200).json({ message: 'Sin charge ID' });
        return;
    }

    const verified = await validateCulqiCharge(chargeId);
    if (!verified.valid || !verified.orderNumber) {
        res.status(200).json({ message: 'Reembolso no procesable' });
        return;
    }

    const order = await Order.findOne({ orderNumber: verified.orderNumber });
    if (order) {
        await orderService.refundOrder(String(order._id), 'webhook_culqi', 'Reembolso procesado desde panel Culqi');
        console.log(`✅ [Culqi Webhook: Reembolso] Orden ${verified.orderNumber} revertida en Base de Datos.`);
    }

    res.status(200).json({ message: 'Reembolso sincronizado correctamente' });
}

async function handleOrderEvent(culqiOrder: CulqiOrderObject, res: Response): Promise<void> {
    const culqiOrderId = culqiOrder.id ?? '';
    console.log(`📱 [Culqi Webhook: Orden Asíncrona] Analizando Orden ID: ${culqiOrderId}`);

    if (!culqiOrderId) {
        console.warn('⚠️ [Culqi Webhook: Orden] Payload sin order ID — ignorado');
        res.status(200).json({ message: 'Sin order ID en payload' });
        return;
    }

    const verified = await validateCulqiOrder(culqiOrderId);
    if (!verified.valid) {
        console.warn(`⚠️ [Culqi Webhook: Orden] API de Culqi NO reconoce la orden ${culqiOrderId}.`);
        res.status(200).json({ message: 'Orden no verificable en API Culqi' });
        return;
    }

    const { state, orderNumber } = verified;
    console.log(`📱 [Culqi Webhook: Orden] Verificado Ok | estado: ${state} | orderNumber: ${orderNumber}`);

    if (!orderNumber) {
        console.warn('⚠️ [Culqi Webhook: Orden] Sin orderNumber en el objeto.');
        res.status(200).json({ message: 'Sin orderNumber identificable' });
        return;
    }

    switch (state) {
        case 'paid': {
            await processApprovedOrder(orderNumber, culqiOrderId, 'culqi-orden');
            res.status(200).json({ message: 'Orden Culqi pagada procesada correctamente' });
            break;
        }
        case 'expired':
        case 'deleted': {
            await Order.findOneAndUpdate(
                { orderNumber },
                {
                    $set: { 'payment.status': PaymentStatus.REJECTED, 'payment.provider': 'culqi-orden', status: OrderStatus.CANCELED },
                    $push: {
                        statusHistory: {
                            status: OrderStatus.CANCELED,
                            changedAt: new Date(),
                            actionBy: 'webhook_culqi',
                            reason: `Orden expirada o eliminada en Culqi (${state})`,
                        },
                    },
                }
            );
            console.log(`❌ [Culqi Webhook: Orden] Orden ${orderNumber} "${state}" — marcada como cancelada en BD`);
            res.status(200).json({ message: `Orden Culqi "${state}" registrada` });
            break;
        }
        case 'pending': {
            console.log(`⏳ [Culqi Webhook: Orden] Orden ${orderNumber} pendiente — esperando pago`);
            res.status(200).json({ message: 'Orden pendiente, sin acción requerida' });
            break;
        }
        default: {
            res.status(200).json({ message: `Estado de orden "${state}" no requiere acción` });
        }
    }
}

async function processApprovedOrder(orderNumber: string, transactionId: string, provider: string): Promise<void> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        console.log(`🔄 [Webhook Processor] Iniciando atomicidad para orden: ${orderNumber} | TxID: ${transactionId}`);

        const order = await Order.findOne({ orderNumber })
            .populate<{ user: { email: string; nombre: string; telefono?: string } }>('user', 'email nombre telefono')
            .session(session);

        if (!order) {
            throw new Error(`Orden comercial no encontrada: ${orderNumber}`);
        }

        if (order.payment?.status === PaymentStatus.APPROVED) {
            console.log(`🛑 [Webhook Processor] IDEMPOTENCIA ACTIVA: La orden ${orderNumber} ya figura como aprobada. Se aborta procesamiento duplicado.`);
            await session.abortTransaction();
            session.endSession();
            return;
        }

        const stockResult = await deductStock(order.items, session);

        order.payment = {
            provider,
            transactionId,
            status: PaymentStatus.APPROVED,
            rawResponse: { transactionId, provider },
        };

        if (stockResult.success) {
            order.status = OrderStatus.PROCESSING;
            order.statusHistory.push({
                status: OrderStatus.PROCESSING,
                changedAt: new Date(),
                actionBy: 'webhook_culqi',
                reason: 'Pago aprobado y stock asignado exitosamente',
            });
            console.log(`✅ [Webhook Processor] Orden ${orderNumber} → Aprobada y Stock Descontado (PROCESSING)`);
        } else {
            order.status = OrderStatus.PAID_BUT_OUT_OF_STOCK;
            order.statusHistory.push({
                status: OrderStatus.PAID_BUT_OUT_OF_STOCK,
                changedAt: new Date(),
                actionBy: 'webhook_culqi',
                reason: `Pago recibido sin stock suficiente en: ${stockResult.outOfStockItems.join(', ')}`,
            });
            console.warn(`⚠️ [Webhook Processor] Orden ${orderNumber} → PAID_BUT_OUT_OF_STOCK. Ítems faltantes: ${stockResult.outOfStockItems.join(', ')}`);
        }

        await order.save({ session });
        await session.commitTransaction();
        session.endSession();

        // ── Notificaciones Asíncronas ──
        const user = order.user as any;
        const emailTarget = user?.email ?? order.customerProfile?.email;
        const nameTarget = user?.nombre ?? order.customerProfile?.nombre;
        const phoneTarget = user?.telefono ?? order.customerProfile?.telefono;

        if (emailTarget) {
            const itemsList = order.items.map((item: any) => item.toObject());
            const shippingInfo = order.shippingAddress?.direccion ?? provider;

            Promise.allSettled([
                OrderEmail.sendOrderConfirmationEmail({ email: emailTarget, name: nameTarget, orderId: order.orderNumber, totalPrice: order.totalPrice, shippingMethod: shippingInfo, items: itemsList }),
                OrderEmail.sendAdminOrderNotificationEmail({ customerName: nameTarget, customerEmail: emailTarget, customerPhone: phoneTarget, orderId: order.orderNumber, totalPrice: order.totalPrice, shippingMethod: shippingInfo, items: itemsList })
            ]).then((results) => {
                results.forEach((result, idx) => {
                    if (result.status === 'rejected') console.error(`⚠️ [Webhook Email] Error envío [${idx === 0 ? 'Cliente' : 'Admin'}]:`, result.reason);
                    else console.log(`✉️ [Webhook Email] Notificación enviada exitosamente a: ${idx === 0 ? 'Cliente' : 'Admin'}`);
                });
            });
        }
    } catch (error) {
        console.error(`❌ [Webhook Processor] Rollback ejecutado para la orden ${orderNumber} debido a un error:`, error);
        if (session.inTransaction()) await session.abortTransaction();
        session.endSession();
        throw error;
    }
}