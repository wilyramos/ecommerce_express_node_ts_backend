import { Router } from 'express';
import { orderController } from './order.controller';
import { authorizeAdmin } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validate.middleware.v3';
import {
    CreateOrderDTOSchema,
    ChargeOrderSchema,
    UpdateOrderStatusSchema,
    GetOrderByIdSchema,
    GetOrderByNumberSchema,
    OrderFiltersQuerySchema
} from './order.schema';

const router = Router();

// ============================================================================
// ── 1. RUTAS PÚBLICAS / CLIENTE (Checkout)
// ============================================================================

// Inicia checkout, valida stock y genera el culqiOrderId
router.post(
    '/checkout',
    validateRequest(CreateOrderDTOSchema),
    orderController.checkout
);

// Procesa el cargo mediante tarjeta o Yape usando el token generado en el frontend
router.post(
    '/:id/charge',
    validateRequest(ChargeOrderSchema),
    orderController.charge
);

// Receptor de notificaciones de Culqi (PagoEfectivo, Billeteras)
router.post(
    '/webhook',
    orderController.webhook
);

// Consulta para las vistas de confirmación (/checkout/success o /checkout/pending)
router.get(
    '/number/:orderNumber',
    validateRequest(GetOrderByNumberSchema),
    orderController.getByNumber
);

// ============================================================================
// ── 2. RUTAS PROTEGIDAS (Panel Admin)
// ============================================================================

router.use(authorizeAdmin);

router.get(
    '/',
    validateRequest(OrderFiltersQuerySchema),
    orderController.getAll
);

router.get(
    '/:id',
    validateRequest(GetOrderByIdSchema),
    orderController.getById
);

router.patch(
    '/:id/status',
    validateRequest(UpdateOrderStatusSchema),
    orderController.updateStatus
);

export default router;