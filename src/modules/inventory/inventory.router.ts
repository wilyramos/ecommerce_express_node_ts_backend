// File: backend/src/modules/inventory/inventory.router.ts

import { Router } from 'express';
import { inventoryController } from './inventory.controller';
import { authenticate, isAdmin } from '../../middleware/auth.middleware';

const router = Router();

// Todas las rutas de inventario requieren autenticación activa y rol de Administrador
router.use(authenticate, isAdmin);

router.get('/', inventoryController.getInventory);
router.get('/logs', inventoryController.getInventoryLogs);
router.patch('/adjust', inventoryController.adjustStock);

export default router;