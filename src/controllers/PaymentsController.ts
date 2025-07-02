// controllers/paymentController.ts
import { Request, Response } from 'express';
import { preference } from '../utils/mercadopago';



export class PaymentsController {

    static async createPreference(req: Request, res: Response) {
        try {
            const { items } = req.body;

            console.log('Received items:', items);

            if (!items || !Array.isArray(items)) {
                res.status(400).json({ error: 'Items are required' });
                return;
            }

            const preferencePayload = {
                items: items.map((item: any) => ({
                    id: item.product,
                    title: item.title,
                    unit_price: item.price,
                    quantity: item.quantity,
                    currency_id: 'PEN', // Use 'PEN' for Peruvian Sol
                })),
                back_urls: {
                    success: 'http://localhost:3000/success',
                    failure: 'http://localhost:3000/failure',
                    pending: 'http://localhost:3000/pending',
                },
                auto_return: 'approved',
                
            };

            console.log('Creating payment preference with payload:', preferencePayload);

            const response = await preference.create({ body: preferencePayload });


            res.status(200).json({
                init_point: response.init_point,
            });
            return;
        } catch (error) {
            console.error('Error creating payment preference:', error);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }
    };
}