// File: backend/src/modules/auth-v3/auth.router.ts
import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validate.middleware.v3';
import { LoginSchema, UpdatePasswordSchema } from './auth.schema';

const router = Router();

// ============================================================================
// ── RUTAS PÚBLICAS
// ============================================================================
router.post(
    '/login',
    validateRequest(LoginSchema),
    authController.login
);

// ============================================================================
// ── RUTAS PROTEGIDAS
// ============================================================================
router.use(authenticate);

router.put(
    '/update-password',
    validateRequest(UpdatePasswordSchema),
    authController.updatePassword
);

export default router;