import { Router } from 'express';
import { body } from 'express-validator';


const router = Router();

router.post('/create-preference',
    body('items').notEmpty().withMessage('Items are required'),
    body('totalPrice').isNumeric().withMessage('Total price must be a number'),
    body('shippingAddress').notEmpty().withMessage('Shipping address is required'),
    body('paymentMethod').notEmpty().withMessage('Payment method is required'),
    body('paymentStatus').notEmpty().withMessage('Payment status is required'),
    async (req, res) => {
        // Handle the request
    }
);

export default router;