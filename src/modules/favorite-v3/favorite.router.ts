// File: backend/src/modules/favorite-v3/favorite.router.ts
import { Router } from 'express';
import { body } from 'express-validator';
import { favoriteController } from './favorite.controller';

// 1. Corrección de importación: Ruta correcta y función authenticate
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

// 2. Uso del middleware correcto para requerir autenticación
router.use(authenticate);

router.post(
    '/toggle',
    [body('productId').isMongoId().withMessage('ID de producto inválido')],
    favoriteController.toggle
);

router.post(
    '/sync',
    [body('productIds').isArray().withMessage('Se espera un array de IDs')],
    favoriteController.sync
);

router.get('/mine', favoriteController.getMine);

export default router;