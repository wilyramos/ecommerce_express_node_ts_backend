// controllers/paymentController.ts
import { Request, Response } from 'express';
import { preference } from '../utils/mercadopago';
import { payment } from '../utils/mercadopago';



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

    static async processPayment(req: Request, res: Response) {
        try {   
            const { token, payment_method_id } = req.body;
            console.log("boddyyy", req.body)
            if (!token || !payment_method_id) {
                res.status(400).json({ message: 'Token and paymentMethodId are required' });
                return;
            }

            const response = await payment.create({ 
                body: req.body
             });

            console.log("Payment processed successfully:", response);
            // res.status(200).json({
            //     status: response.status,
            //     message: 'Payment processed',
            //     response, 
            // });

            res.status(200).json(response);
        } catch (error) {
            console.error('Error processing payment:', error);
            res.status(500).json({ message: 'Internal Server Error' });
            return;
        }
    }

    static async verifyPayment(req: Request, res: Response) {
        try {
            const { paymentId } = req.params;

            if (!paymentId) {
                res.status(400).json({ message: 'Payment ID is required' });
                return;
            }

            const response = await payment.get({ id: paymentId });

            console.log(response);

            res.status(200).json(response);
        } catch (error) {
            console.error('Error verifying payment:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    }

}