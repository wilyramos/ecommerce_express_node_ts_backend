// File: backend/src/modules/discount/discount.router.ts
import { Router } from 'express';
import { discountController } from './discount.controller';
import { authenticate, authorizeAdmin } from '../../middleware/auth.middleware';

const router = Router();

// PUBLIC/CLIENTE - Validar cupón en tiempo real (Checkout/Carrito)
router.post('/validate', discountController.validateCoupon);

// ADMIN - CRUD de Cupones
router.get('/', authorizeAdmin, discountController.getAll);
router.post('/', authorizeAdmin, discountController.create);
router.patch('/:id/toggle', authorizeAdmin, discountController.toggleStatus);
router.delete('/:id', authorizeAdmin, discountController.delete);

export default router;