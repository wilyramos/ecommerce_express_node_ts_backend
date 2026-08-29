import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Order, { PaymentStatus, OrderStatus } from '../../models/Order';
import { OrderEmail } from '../../emails/OrderEmailResend';
import { deductStock } from './deductStock';
import { validateCulqiCharge, validateCulqiOrder } from './culqi.verify';
import { orderService } from '../order/order.service';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos internos basados en la documentación oficial de Culqi
// ─────────────────────────────────────────────────────────────────────────────

interface CulqiWebhookEvent {
    type: string;
    data?: any;
}

interface CulqiChargeObject {
    id: string;
    state?: string;
    outcome?: {
        type: string;
        code: string;
        userMessage?: string;
    };
    metadata?: { [key: string]: unknown };
}

interface CulqiOrderObject {
    id: string;
    state: string; // "paid" | "expired" | "deleted" | "pending"
    metadata?: { [key: string]: unknown };
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler principal del webhook
// ─────────────────────────────────────────────────────────────────────────────

export async function handleWebhookCulqi(req: Request, res: Response): Promise<void> {
    try {
        const event =
            typeof req.body === 'object' && !(req.body instanceof Buffer)
                ? (req.body as CulqiWebhookEvent)
                : (JSON.parse((req.body as Buffer).toString('utf8')) as CulqiWebhookEvent);

        const eventType = event.type ?? '';
        const eventObject =
            typeof event.data === 'string'
                ? JSON.parse(event.data)
                : (event.data ?? event);

        console.log('📦 [Culqi] Evento recibido:', eventType);
        console.log('📦 [Culqi] Payload:', JSON.stringify(eventObject, null, 2));

        // ── Cargos (tarjeta / Yape directo) ──────────────────────────────────
        if (
            eventType === 'charge.creation.succeeded' ||
            eventType === 'charge.status.changed' ||
            eventType === 'charge.update.succeeded'
        ) {
            await handleChargeEvent(eventObject as CulqiChargeObject, res);
            return;
        }

        // ── Reembolsos en pasarela ───────────────────────────────────────────
        if (eventType === 'charge.refunded') {
            await handleRefundEvent(eventObject as CulqiChargeObject, res);
            return;
        }

        // ── Órdenes de pago (PagoEfectivo / billeteras / Cuotéalo) ───────────
        if (eventType === 'order.status.changed') {
            await handleOrderEvent(eventObject as CulqiOrderObject, res);
            return;
        }

        console.log(`ℹ️ [Culqi] Evento ignorado: ${eventType}`);
        res.status(200).json({ message: `Evento "${eventType}" no manejado` });
    } catch (error) {
        console.error('❌ [Culqi] Error inesperado en el webhook:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler: Cargos (tarjeta / Yape directo)
// ─────────────────────────────────────────────────────────────────────────────

async function handleChargeEvent(charge: CulqiChargeObject, res: Response): Promise<void> {
    const chargeId = charge.id ?? '';

    if (!chargeId) {
        console.warn('⚠️ [Culqi Cargo] Payload sin charge ID — ignorado');
        res.status(200).json({ message: 'Sin charge ID en payload' });
        return;
    }

    const verified = await validateCulqiCharge(chargeId);

    if (!verified.valid) {
        console.warn(`⚠️ [Culqi Cargo] No se pudo verificar cargo ${chargeId} — ignorado`);
        res.status(200).json({ message: 'Cargo no verificable en API Culqi' });
        return;
    }

    const { outcomeType, orderNumber } = verified;
    console.log('💳 [Culqi Cargo verificado]', { chargeId, outcomeType, orderNumber });

    if (!orderNumber) {
        console.warn('⚠️ [Culqi Cargo] Sin orderNumber en el objeto de pago — ignorado');
        res.status(200).json({ message: 'Sin orderNumber identificable en el cargo' });
        return;
    }

    if (outcomeType !== 'venta_exitosa') {
        console.log(`ℹ️ [Culqi Cargo] outcome_type "${outcomeType}" — sin acción requerida`);
        res.status(200).json({ message: `outcome_type "${outcomeType}" no requiere acción` });
        return;
    }

    await processApprovedOrder(orderNumber, chargeId, 'culqi-cargo');
    res.status(200).json({ message: 'Cargo aprobado procesado correctamente' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler: Reembolsos automáticos desde Culqi
// ─────────────────────────────────────────────────────────────────────────────

async function handleRefundEvent(charge: CulqiChargeObject, res: Response): Promise<void> {
    const chargeId = charge.id ?? '';
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
        console.log(`↩️ [Culqi Refund] Orden ${verified.orderNumber} revertida`);
    }

    res.status(200).json({ message: 'Reembolso sincronizado correctamente' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler: Órdenes de Culqi (PagoEfectivo / billeteras / Cuotéalo)
// ─────────────────────────────────────────────────────────────────────────────

async function handleOrderEvent(culqiOrder: CulqiOrderObject, res: Response): Promise<void> {
    const culqiOrderId = culqiOrder.id ?? '';

    if (!culqiOrderId) {
        console.warn('⚠️ [Culqi Orden] Payload sin order ID — ignorado');
        res.status(200).json({ message: 'Sin order ID en payload' });
        return;
    }

    const verified = await validateCulqiOrder(culqiOrderId);

    if (!verified.valid) {
        console.warn(`⚠️ [Culqi Orden] No se pudo verificar orden ${culqiOrderId} — ignorado`);
        res.status(200).json({ message: 'Orden no verificable en API Culqi' });
        return;
    }

    const { state, orderNumber } = verified;
    console.log('📱 [Culqi Orden verificada]', { culqiOrderId, state, orderNumber });

    if (!orderNumber) {
        console.warn('⚠️ [Culqi Orden] Sin orderNumber en el objeto de orden — ignorado');
        res.status(200).json({ message: 'Sin orderNumber identificable en la orden Culqi' });
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
                    $set: {
                        'payment.status': PaymentStatus.REJECTED,
                        'payment.provider': 'culqi-orden',
                        status: OrderStatus.CANCELED,
                    },
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
            console.log(`❌ [Culqi Orden] Orden ${orderNumber} "${state}" — marcada como cancelada`);
            res.status(200).json({ message: `Orden Culqi "${state}" registrada` });
            break;
        }
        case 'pending': {
            console.log(`⏳ [Culqi Orden] Orden ${orderNumber} pendiente — sin acción`);
            res.status(200).json({ message: 'Orden pendiente, sin acción requerida' });
            break;
        }
        default: {
            console.log(`ℹ️ [Culqi Orden] Estado "${state}" — sin acción`);
            res.status(200).json({ message: `Estado de orden "${state}" no requiere acción` });
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Procesar una orden aprobada (transacción atómica con MongoDB session)
// ─────────────────────────────────────────────────────────────────────────────

async function processApprovedOrder(
    orderNumber: string,
    transactionId: string,
    provider: string
): Promise<void> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        console.log(`🔄 [Culqi] Procesando orden aprobada: ${orderNumber} | tx: ${transactionId}`);

        const order = await Order.findOne({ orderNumber })
            .populate<{ user: { email: string; nombre: string; telefono?: string } }>('user', 'email nombre telefono')
            .session(session);

        if (!order) {
            throw new Error(`Orden no encontrada por orderNumber: ${orderNumber}`);
        }

        // Idempotencia: si ya fue aprobada, salir limpiamente
        if (order.payment?.status === PaymentStatus.APPROVED) {
            console.warn(`⚠️ [Culqi] Orden ${orderNumber} ya procesada — descartando duplicado`);
            await session.abortTransaction();
            session.endSession();
            return;
        }

        // Intentar descontar stock
        const stockResult = await deductStock(order.items, session);

        // Registrar el pago como aprobado
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
            console.log(`✅ [Culqi] Orden ${orderNumber} → PROCESSING`);
        } else {
            order.status = OrderStatus.PAID_BUT_OUT_OF_STOCK;
            order.statusHistory.push({
                status: OrderStatus.PAID_BUT_OUT_OF_STOCK,
                changedAt: new Date(),
                actionBy: 'webhook_culqi',
                reason: `Pago recibido sin stock suficiente en: ${stockResult.outOfStockItems.join(', ')}`,
            });
            console.warn(
                `⚠️ [Culqi] Orden ${orderNumber} → PAID_BUT_OUT_OF_STOCK. ` +
                `Ítems sin stock: ${stockResult.outOfStockItems.join(', ')}`
            );
        }

        await order.save({ session });
        await session.commitTransaction();
        session.endSession();

        // ── Envío de correos de confirmación (fuera de la transacción) ─────────
        const user = order.user as any;
        const emailTarget = user?.email ?? order.customerProfile?.email;
        const nameTarget = user?.nombre ?? order.customerProfile?.nombre;
        const phoneTarget = user?.telefono ?? order.customerProfile?.telefono;

        if (emailTarget) {
            const itemsList = order.items.map((item: any) => item.toObject());
            const shippingInfo = order.shippingAddress?.direccion ?? provider;

            Promise.allSettled([
                OrderEmail.sendOrderConfirmationEmail({
                    email: emailTarget,
                    name: nameTarget,
                    orderId: order.orderNumber,
                    totalPrice: order.totalPrice,
                    shippingMethod: shippingInfo,
                    items: itemsList,
                }),
                OrderEmail.sendAdminOrderNotificationEmail({
                    customerName: nameTarget,
                    customerEmail: emailTarget,
                    customerPhone: phoneTarget,
                    orderId: order.orderNumber,
                    totalPrice: order.totalPrice,
                    shippingMethod: shippingInfo,
                    items: itemsList,
                })
            ]).then((results) => {
                results.forEach((result, idx) => {
                    if (result.status === 'rejected') {
                        console.error(`⚠️ [Culqi Email] Error en envío [${idx === 0 ? 'Cliente' : 'Admin'}]:`, result.reason);
                    } else {
                        console.log(`✉️ [Culqi Email] Notificación enviada a: ${idx === 0 ? 'Cliente' : 'Admin'}`);
                    }
                });
            });
        }

        console.log(`✅ [Culqi] Orden ${orderNumber} procesada exitosamente`);
    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        session.endSession();
        throw error;
    }
}