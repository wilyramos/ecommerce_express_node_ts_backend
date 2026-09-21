// File: backend/src/modules/user-v3/user.router.ts
import { Router } from 'express';
import { userController } from './user.controller';
import { authenticate, authorizeAdmin } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validate.middleware.v3';
import {
    CreateUserSchema,
    UpdateUserSchema,
    UpdateProfileSchema,
    GetUserByIdSchema,
    UserFiltersQuerySchema
} from './user.schema';

const router = Router();

// ============================================================================
// ── 1. RUTAS DE PERFIL (Cualquier usuario autenticado)
// ============================================================================

router.use('/profile', authenticate);

router.get('/profile', userController.getProfile);

router.put(
    '/profile',
    validateRequest(UpdateProfileSchema),
    userController.updateProfile
);


// ============================================================================
// ── 2. RUTAS PROTEGIDAS (Panel Admin)
// ============================================================================

router.use(authenticate, authorizeAdmin);

router.get(
    '/',
    validateRequest(UserFiltersQuerySchema),
    userController.getAll
);

router.get(
    '/:id',
    validateRequest(GetUserByIdSchema),
    userController.getById
);

router.post(
    '/',
    validateRequest(CreateUserSchema),
    userController.create
);

router.put(
    '/:id',
    validateRequest(UpdateUserSchema),
    userController.update
);

router.patch(
    '/:id/toggle-status',
    validateRequest(GetUserByIdSchema),
    userController.toggleStatus
);

router.delete(
    '/:id',
    validateRequest(GetUserByIdSchema),
    userController.delete
);

export default router;