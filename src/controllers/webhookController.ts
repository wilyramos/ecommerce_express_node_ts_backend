// controllers/paymentController.ts
import { Request, Response } from 'express';
import { preference, payment } from '../utils/mercadopago';

export class WebhookController {

    static async handleWebHookMercadoPago(req: Request, res: Response) {

        try {
            const event = req.body;

            console.log('Received Mercado Pago webhook event:', event);

            // Handle the event based on its type
            switch (event.type) {
                case 'payment':
                    const paymentData = event.data;
                    console.log('Payment data:', paymentData);
                    // Process payment data as needed
                    break;
                // Add more cases for different event types if needed
                default:
                    console.warn(`Unhandled event type: ${event.type}`);
            }

            res.status(200).json({ message: 'Webhook received successfully' });
        } catch (error) {
            console.error('Error handling Mercado Pago webhook:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    


    }
}