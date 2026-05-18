// File: backend/src/routes/comparison.route.ts

import { Router } from 'express';
import { ComparisonController } from './comparison.controller';
// import { authenticate, isAdminOrVendedor } from '../../middleware/auth';

const router = Router();

// Rutas base
router.route('/')
    .get(ComparisonController.getAll) // Público: Permitir lecturas desde la tienda y catálogo
    .post( ComparisonController.create);

// Rutas públicas de consulta especializada para indexación SEO y widgets frontend
router.get('/slug/:slug', ComparisonController.getBySlug);
router.get('/product/:productId', ComparisonController.getRelatedToProduct);

// Rutas de administración con restricciones de escritura y borrado lógico
router.route('/:id')
    .put( ComparisonController.update)
    .delete( ComparisonController.delete);

    // Rutas de administración con restricciones de escritura y lectura por ID
router.route('/:id')
    .get(ComparisonController.getById) // <-- Asegúrate de agregar esta línea
    .put(ComparisonController.update)
    .delete(ComparisonController.delete);

export default router;