import { Router } from 'express';
import { body } from 'express-validator';
import {PaymentsController} from '../controllers/PaymentsController';


const router = Router();

router.post('/create-preference',
    body('items').isArray().withMessage('Items must be an array'),
    PaymentsController.createPreference
);
    
export default router;