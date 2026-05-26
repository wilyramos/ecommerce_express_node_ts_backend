// File: src/modules/media/media.routes.ts
import { Router } from 'express';
import { MediaController } from './media.controller';
import { isAdminOrVendedor } from '../../middleware/auth.middleware';


const router = Router();

/**
 * POST   /api/media/upload        → Sube 1-10 archivos (imagen o video)
 * GET    /api/media               → Lista medios por carpeta (paginado)
 * GET    /api/media/:id           → Obtiene un medio por ID
 * DELETE /api/media/:id           → Elimina de Cloudinary + BD
 */

router.post(
    '/upload',
    isAdminOrVendedor,
    MediaController.upload
);

router.get('/', isAdminOrVendedor, MediaController.list);

router.get('/:id', isAdminOrVendedor, MediaController.getOne);

router.delete(
    '/:id',
    isAdminOrVendedor,
    MediaController.deleteById
);

export default router;