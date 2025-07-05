// controllers/paymentController.ts
import { Request, Response } from 'express';
import { preference, payment } from '../utils/mercadopago';
import Order from '../models/Order';

export class WebhookController {

    static async handleWebHookMercadoPago(req: Request, res: Response) {

        try {
            const event = req.body;

            console.log('🔔 Webhook recibido:', event);

            if (event.type === 'payment' && event.data?.id) {
                const paymentId = event.data.id;
                const paymentData = await payment.get({ id: paymentId });
                if (!paymentData) {
                    console.error('❌ No se encontró el pago con ID:', paymentId);
                     res.status(404).json({ message: 'Pago no encontrado' });
                     return;
                }

                console.log('✅ Payment data retrieved:', paymentData);

                const { status, metadata } = paymentData;

                const orderId = metadata?.order_id;
                if (orderId) {
                    await Order.findByIdAndUpdate(orderId, {
                        paymentStatus: status === 'approved' ? 'PAGADO' : 'PENDIENTE',
                        status: status === 'approved' ? 'PROCESANDO' : 'PENDIENTE',
                        paymentId,
                    });

                }
            }

            res.status(200).json({ message: 'Webhook procesado correctamente' });
        } catch (error) {
            console.error('❌ Error al procesar el Webhook de Mercado Pago:', error);
            res.status(500).json({ message: 'Error interno del servidor' });
            return;
        }
    }
}