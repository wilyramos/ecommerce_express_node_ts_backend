// controllers/paymentController.ts
import { Request, Response } from 'express';
import { preference } from '../utils/mercadopago';
import { getFormTokenFromIzipay } from '../utils/izipayService';



export class PaymentsController {

    static async createPreference(req: Request, res: Response) {
        try {
            const { items, payer, orderId } = req.body;

            console.log('Received request payer:', payer);

            // console.log('Creating payment preference with items:', req.body);

            if (!items || !Array.isArray(items)) {
                res.status(400).json({ message: 'Items are required' });
                return;
            }

            if (!orderId) {
                res.status(400).json({ message: 'orderId is required in metadata' });
                return;
            }

            console.log("payer", payer);

            const preferencePayload = {
                items: items,
                payer: payer,
                back_urls: {
                    success: `${process.env.MP_SUCCESS_URL}?orderId=${orderId}`, // Use the orderId from the request body
                    failure: `${process.env.MP_FAILURE_URL}?orderId=${orderId}`, // Use the orderId from the request body
                    pending: `${process.env.MP_PENDING_URL}?orderId=${orderId}`, // Use the orderId from the request body
                },
                auto_return: 'approved',
                metadata: { // Se puede incluir todos los datos que se necesiten
                    order_id: orderId, // Use the orderId from the request body
                },
                external_reference: orderId, // Use the orderId from the request body
                notification_url: process.env.MP_NOTIFICATION_URL,
            };

            console.log('Creating payment preference with payload:', preferencePayload);

            const response = await preference.create({ body: preferencePayload });

            res.status(200).json({
                init_point: response.init_point,
            });
        } catch (error) {
            // console.error('Error creating payment preference:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    }

    static async getIzipayFormToken(req: Request, res: Response) {
        try {
            const { transactionId } = req.body;

            const amount = 10000

            if (!transactionId) {
                res.status(400).json({ message: 'transactionId es requerido' });
                return;
            }

            const { formToken } = await getFormTokenFromIzipay(transactionId, amount);

            if (!formToken) {
                res.status(500).json({ message: 'No se pudo obtener el token desde Izipay' });
                return;
            }

            res.status(200).json({ formToken });
            return;
        } catch (error) {
            res.status(500).json({ message: 'Error interno del servidor' });
            return;
        }
    }
}