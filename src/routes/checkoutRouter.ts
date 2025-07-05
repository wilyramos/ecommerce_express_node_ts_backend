import { Router } from 'express';
import { body } from 'express-validator';
import {PaymentsController} from '../controllers/PaymentsController';
import { authenticate } from '../middleware/auth';


const router = Router();

router.post('/create-preference',
    authenticate,
    body('items').isArray().withMessage('Items must be an array'),
    PaymentsController.createPreference
);
    
export default router;