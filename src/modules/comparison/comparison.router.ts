import { Router } from 'express';
import { ComparisonController } from './comparison.controller';
import { authenticate, isAdminOrVendedor } from '../../middleware/auth';

const router = Router();

router.route('/')
    .get(ComparisonController.getAll)
    .post(ComparisonController.create);
    // .post(authenticate, isAdminOrVendedor, ComparisonController.create);

router.get('/slug/:slug', ComparisonController.getBySlug);
router.get('/product/:productId', ComparisonController.getRelatedToProduct);

router.route('/:id')
    .get(authenticate, isAdminOrVendedor, ComparisonController.getById)
    .put(authenticate, isAdminOrVendedor, ComparisonController.update)
    .delete(authenticate, isAdminOrVendedor, ComparisonController.delete);

export default router;