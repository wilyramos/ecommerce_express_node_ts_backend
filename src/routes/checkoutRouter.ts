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

// Izipay
router.post('/izipay/get-token',
    // authenticate,
    PaymentsController.getIzipayFormToken
);
    
export default router;