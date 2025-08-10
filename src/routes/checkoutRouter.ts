import { Router } from 'express';
import { body } from 'express-validator';
import {PaymentsController} from '../controllers/PaymentsController';
import { authenticate } from '../middleware/auth';


const router = Router();


// Mercadopago
router.post('/create-preference',
    authenticate,
    body('items').isArray().withMessage('Items must be an array'),
    PaymentsController.createPreference
);

// process payment mercadopago checkoutbriks
router.post('/process-payment',
    authenticate,
    body('formData').notEmpty().withMessage('Form data is required'),
    PaymentsController.processPayment
);

// api checkout mercadopago

// Izipay
// router.post('/izipay/get-token',
//     // authenticate,
//     // PaymentsController.getIzipayFormToken
// );
    
export default router;