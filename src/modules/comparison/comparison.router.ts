// backend/src/modules/comparison/comparison.router.ts

import { Router } from 'express';
import { body, param } from 'express-validator';
import { comparisonController } from './comparison.controller';
import { authorizeAdmin } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validate.middleware';

const router = Router();

// ── 1. PUBLIC ────────────────────────────────────────────────────────

router.get('/', comparisonController.getAllPublic);

router.get(
    '/product/:productId',
    [
        param('productId').isMongoId().withMessage('El ID del producto no es un ObjectId válido'),
        validateRequest,
    ],
    comparisonController.getByProduct
);

router.get(
    '/slug/:slug',
    [
        param('slug').trim().notEmpty().withMessage('El slug es requerido'),
        validateRequest,
    ],
    comparisonController.getBySlug
);

// ── 2. ADMIN ─────────────────────────────────────────────────────────

router.use('/admin', authorizeAdmin);

router.get('/admin', comparisonController.getAllAdmin);

router.get(
    '/admin/:id',
    [
        param('id').isMongoId().withMessage('El ID ingresado no es un ObjectId válido'),
        validateRequest,
    ],
    comparisonController.getById
);

router.post(
    '/admin',
    [
        body('title').trim().notEmpty().withMessage('El título es requerido'),
        body('products').isArray({ min: 2 }).withMessage('Debe proveer al menos 2 productos a comparar'),
        body('products.*').isMongoId().withMessage('Cada producto debe ser un ObjectId válido'),
        body('veredictoRapido').trim().notEmpty().withMessage('El veredicto rápido es requerido'),
        body('especificaciones').optional().isArray(),
        body('faqItems').optional().isArray(),
        validateRequest,
    ],
    comparisonController.create
);

router.put(
    '/admin/:id',
    [
        param('id').isMongoId().withMessage('El ID ingresado no es un ObjectId válido'),
        body('title').optional().trim().notEmpty().withMessage('El título no puede estar vacío'),
        body('products').optional().isArray({ min: 2 }).withMessage('Debe proveer al menos 2 productos a comparar'),
        body('products.*').optional().isMongoId().withMessage('Cada producto debe ser un ObjectId válido'),
        body('veredictoRapido').optional().trim().notEmpty().withMessage('El veredicto rápido no puede estar vacío'),
        validateRequest,
    ],
    comparisonController.update
);

router.patch(
    '/admin/:id/toggle-status',
    [
        param('id').isMongoId().withMessage('El ID ingresado no es un ObjectId válido'),
        validateRequest,
    ],
    comparisonController.toggleStatus
);

router.patch(
    '/admin/:id/toggle-featured',
    [
        param('id').isMongoId().withMessage('El ID ingresado no es un ObjectId válido'),
        validateRequest,
    ],
    comparisonController.toggleFeatured
);

router.delete(
    '/admin/:id',
    [
        param('id').isMongoId().withMessage('El ID ingresado no es un ObjectId válido'),
        validateRequest,
    ],
    comparisonController.delete
);

export default router;