//File: backend/src/modules/webhook-v3/webhook.controller.ts

import { Request, Response } from 'express';
import Order, { OrderStatus, PaymentStatus } from '../../models/Order';

export const webhookController = {
    culqi: async (req: Request, res: Response) => {
        try {
            // IMPORTANTE: En producción, verificar la firma del webhook con CULQI_WEBHOOK_SECRET

            const event = req.body;
            const eventType = event.type;
            const data = event.data;

            if (eventType === 'order.status.changed') {
                if (data.state === 'paid') {
                    // El cliente pagó vía PagoEfectivo o Billetera
                    const orderNumber = data.order_number;
                    const order = await Order.findOne({ orderNumber });

                    if (order && order.status === OrderStatus.AWAITING_PAYMENT) {
                        order.status = OrderStatus.PROCESSING;
                        order.payment!.status = PaymentStatus.APPROVED;
                        order.statusHistory.push({ status: OrderStatus.PROCESSING, changedAt: new Date(), reason: 'Webhook: Orden pagada' });
                        await order.save();
                    }
                }
            }

            res.status(200).send('Webhook recibido');
        } catch (error) {
            console.error('Webhook Error:', error);
            res.status(400).send('Error procesando webhook');
        }
    }
};