// comparison.router.ts

import { Router } from 'express';
import { ComparisonController } from './comparison.controller';
import { authenticate, isAdminOrVendedor } from '../../middleware/auth';

const router = Router();

// ── Rutas públicas ────────────────────────────────────────

router.get('/',                          ComparisonController.getAll);
router.get('/slug/:slug',                ComparisonController.getBySlug);
router.get('/product/:productId',        ComparisonController.getRelatedToProduct);

// ── Rutas protegidas ──────────────────────────────────────

router.post(  '/',    authenticate, isAdminOrVendedor, ComparisonController.create);
router.get(   '/:id', authenticate, isAdminOrVendedor, ComparisonController.getById);
router.put(   '/:id', authenticate, isAdminOrVendedor, ComparisonController.update);
router.delete('/:id', authenticate, isAdminOrVendedor, ComparisonController.delete);

export default router;