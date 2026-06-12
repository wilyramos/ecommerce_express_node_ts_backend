// File: src/modules/media/media.routes.ts
import { Router } from 'express';
import { MediaController } from './media.controller';
import { authorizeAdminOrVendedor } from '../../middleware/auth.middleware';

const router = Router();

router.post(
    '/upload',
    authorizeAdminOrVendedor, // Ejecuta: authenticate -> isAdminOrVendedor
    MediaController.upload
);

router.post('/sign-upload', authorizeAdminOrVendedor, MediaController.signUpload);
router.post('/register', authorizeAdminOrVendedor, MediaController.register);


router.get(
    '/', 
    authorizeAdminOrVendedor,
    MediaController.list
);

router.get(
    '/:id', 
    authorizeAdminOrVendedor,
    MediaController.getOne
);

router.delete(
    '/:id',
    authorizeAdminOrVendedor,
    MediaController.deleteById
);

export default router;