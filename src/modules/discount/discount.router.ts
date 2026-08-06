// File: backend/src/modules/discount/discount.router.ts

import { Router } from 'express';
import { body, param } from 'express-validator';
import { discountController } from './discount.controller';
import { authenticate, isAdmin } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validate.middleware';

const router = Router();

// ── 1. PUBLIC/CLIENTE — Endpoints del Carrito y Checkout ────────────────────

router.post(
    '/evaluate-automatic',
    [
        body('subtotal').isNumeric().withMessage('El subtotal debe ser un número válido'),
        body('cartItems').isArray({ min: 1 }).withMessage('El carrito no puede estar vacío'),
        validateRequest
    ],
    discountController.evaluateAutomatic
);

router.get('/product/:productId/automatic', discountController.getProductAutomaticDiscounts);

router.post(
    '/validate',
    [
        body('code').trim().notEmpty().withMessage('El código de cupón es requerido'),
        body('subtotal').isNumeric().withMessage('El subtotal debe ser un número válido'),
        body('cartItems').isArray({ min: 1 }).withMessage('El carrito no puede estar vacío'),
        validateRequest
    ],
    discountController.validateCoupon
);

// ── 2. ADMIN — CRUD y Lectura General ───────────────────────────────────────

router.get('/', authenticate, isAdmin, discountController.getAll);

router.post(
    '/',
    authenticate,
    isAdmin,
    [
        body('title').trim().notEmpty().withMessage('El título de la promoción es requerido'),
        body('description').trim().notEmpty().withMessage('La descripción es requerida'),
        body('type').notEmpty().withMessage('El tipo de descuento es requerido'),
        validateRequest
    ],
    discountController.create
);

// ── 3. ADMIN — Rutas con Sub-recursos Específicos (/analytics) ───────────────
// NOTA: Debe ir ANTES de /:id para evitar que Express intercepte la sub-ruta /analytics

router.get(
    '/:code/analytics',
    authenticate,
    isAdmin,
    [
        param('code').trim().notEmpty().withMessage('El código del cupón es requerido'),
        validateRequest
    ],
    discountController.getAnalytics
);

// ── 4. ADMIN — Rutas Paramétricas Genéricas por ID ──────────────────────────

router.get(
    '/:id',
    authenticate,
    isAdmin,
    [
        param('id').isMongoId().withMessage('El ID ingresado no es un ObjectId válido'),
        validateRequest
    ],
    discountController.getById
);

router.patch(
    '/:id/toggle',
    authenticate,
    isAdmin,
    [
        param('id').isMongoId().withMessage('El ID ingresado no es un ObjectId válido'),
        validateRequest
    ],
    discountController.toggleStatus
);

router.delete(
    '/:id',
    authenticate,
    isAdmin,
    [
        param('id').isMongoId().withMessage('El ID ingresado no es un ObjectId válido'),
        validateRequest
    ],
    discountController.delete
);

export default router;