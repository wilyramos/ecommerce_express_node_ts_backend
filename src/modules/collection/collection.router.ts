import { Router } from 'express';
import {
    createCollection,
    getAllCollections,
    getCollectionById,
    getCollectionBySlug,
    getActivePromotions,
    getHomepageSections,
    updateCollection,
    deleteCollection,
    addProductsToCollection,
    removeProductFromCollection,
    getActiveCollections,
    getCollectionProducts,
    updateCollectionsOrder,
    updateHomepageOrder,
} from './collection.controller';
import { authorizeAdminOrVendedor } from '../../middleware/auth.middleware';

const router = Router();

// ─── RUTAS PÚBLICAS (CLIENTE ANÓNIMO / ACCESO LIBRE) ──────────────────────────
router.get('/public/homepage', getHomepageSections);
router.get('/public/promotions', getActivePromotions);
router.get('/public/active', getActiveCollections);
router.get('/public/:slug', getCollectionBySlug);

// ─── RUTAS GESTIÓN COMERCIAL (RESTRINGIDAS: ADMIN Y VENDEDORES) ───────────────
router.get('/', authorizeAdminOrVendedor, getAllCollections);
router.post('/', authorizeAdminOrVendedor, createCollection);
router.get('/:id', authorizeAdminOrVendedor, getCollectionById);
router.put('/:id', authorizeAdminOrVendedor, updateCollection);
router.delete('/:id', authorizeAdminOrVendedor, deleteCollection);

router.put('/reorder/general', authorizeAdminOrVendedor, updateCollectionsOrder);
router.put('/reorder/homepage', authorizeAdminOrVendedor, updateHomepageOrder);

// ─── GESTIÓN DE PRODUCTOS (RESTRINGIDAS: ADMIN Y VENDEDORES) ──────────────────
router.post('/:id/products', authorizeAdminOrVendedor, addProductsToCollection);
router.delete('/:id/products/:productId', authorizeAdminOrVendedor, removeProductFromCollection);
router.get('/:id/products/list', authorizeAdminOrVendedor, getCollectionProducts);

export default router;