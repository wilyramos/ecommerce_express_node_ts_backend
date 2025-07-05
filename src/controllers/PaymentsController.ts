// controllers/paymentController.ts
import { Request, Response } from 'express';
import { preference } from '../utils/mercadopago';



export class PaymentsController {

    static async createPreference(req: Request, res: Response) {
        try {
            const { items, payer, orderId } = req.body;

            if (!items || !Array.isArray(items)) {
                res.status(400).json({ message: 'Items are required' });
                return;
            }

            if (!orderId) {
                res.status(400).json({ message: 'orderId is required in metadata' });
                return;
            }

            const preferencePayload = {
                items: items.map((item) => ({
                    id: item.id,
                    title: item.title,
                    description: item.description || '',
                    quantity: item.quantity,
                    unit_price: parseFloat(item.unit_price),
                    currency_id: item.currency_id || 'PEN',
                })),
                payer: {
                    email: payer.email,
                    first_name: payer.first_name || '',
                    last_name: payer.last_name || '',
                    phone: {
                        area_code: payer.phone?.area_code || '51',
                        number: payer.phone?.number || '',
                    },
                },
                back_urls: {
                    success: process.env.MP_SUCCESS_URL,
                    failure: process.env.MP_FAILURE_URL,
                    pending: process.env.MP_PENDING_URL,
                },
                auto_return: 'approved',
                metadata: {
                    orderId: orderId, // <-- este es el valor clave
                },
            };

            const response = await preference.create({ body: preferencePayload });

            res.status(200).json({
                init_point: response.init_point,
            });
        } catch (error) {
            console.error('Error creating payment preference:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    }
}