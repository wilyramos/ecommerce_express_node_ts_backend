// File: backend/src/modules/icon/icon.routes.ts

import { Router } from 'express';
import { IconController } from './icon.controller';
import { authorizeAdminOrVendedor } from '../../middleware/auth.middleware';

const router = Router();

router.post(
    '/',
    authorizeAdminOrVendedor,
    IconController.create
);

router.get(
    '/',
    authorizeAdminOrVendedor,
    IconController.list
);

router.get(
    '/:id',
    authorizeAdminOrVendedor,
    IconController.getOne
);

router.put(
    '/:id',
    authorizeAdminOrVendedor,
    IconController.update
);

router.delete(
    '/:id',
    authorizeAdminOrVendedor,
    IconController.delete
);

export default router;