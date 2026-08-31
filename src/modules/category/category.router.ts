// File: backend/src/modules/category/category.router.ts

import { Router } from 'express';
import { param } from 'express-validator';
import { categoryController } from './category.controller';
import { authorizeAdmin } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validate.middleware.v3';
import { 
    CreateCategorySchema, 
    UpdateCategorySchema, 
    BulkStatusSchema, 
    BulkDeleteSchema, 
    ReorderCategoriesSchema 
} from './category.schema';

const router = Router();

// ── 1. PUBLIC ROUTES ──────────────────────────────────────────────────
router.get('/tree', categoryController.getTree);

router.get(
    '/slug/:slug',
    [param('slug').trim().notEmpty().withMessage('El slug es requerido')],
    categoryController.getBySlug
);

router.get(
    '/:id',
    [param('id').isMongoId().withMessage('El ID ingresado no es válido')],
    categoryController.getById
);

// ── 2. ADMIN ROUTES ───────────────────────────────────────────────────
router.use(authorizeAdmin);

router.post(
    '/',
    validateRequest(CreateCategorySchema),
    categoryController.create
);

// FIX: Cambiado a PUT para asegurar la transmisión del body
router.put(
    '/bulk-status',
    validateRequest(BulkStatusSchema),
    categoryController.bulkStatus
);

router.post(
    '/bulk-delete',
    validateRequest(BulkDeleteSchema),
    categoryController.bulkDelete
);

// FIX: Cambiado a PUT para asegurar la transmisión del body
router.put(
    '/reorder',
    validateRequest(ReorderCategoriesSchema),
    categoryController.reorder
);

router.patch(
    '/:id/toggle-status',
    [param('id').isMongoId().withMessage('El ID ingresado no es válido')],
    categoryController.toggleStatus
);

router.put(
    '/:id',
    [param('id').isMongoId().withMessage('El ID ingresado no es válido')],
    validateRequest(UpdateCategorySchema),
    categoryController.update
);

router.delete(
    '/:id',
    [param('id').isMongoId().withMessage('El ID ingresado no es válido')],
    categoryController.delete
);

export default router;