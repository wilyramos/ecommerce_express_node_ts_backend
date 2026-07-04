// File: backend/src/modules/order/order.router.ts

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { orderController } from './order.controller';
import { authenticate, isAdmin, isAdminOrVendedor } from '../../middleware/auth.middleware';
import { Request, Response, NextFunction } from 'express';

const router = Router();

// ── Middleware: autenticación opcional ───────────────────────────────────────

const optionalAuthenticate = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    if (!req.headers.authorization?.startsWith('Bearer ')) return next();
    try {
        await authenticate(req, res, () => next());
    } catch {
        req.user = undefined;
        next();
    }
};

// ── Validadores reutilizables ─────────────────────────────────────────────────

const validateMongoId = param('id').isMongoId().withMessage('ID de orden inválido');

const validateCreateOrder = [
    body('customerProfile').isObject().withMessage('customerProfile es requerido'),
    body('customerProfile.nombre').trim().notEmpty().withMessage('El nombre es requerido'),
    body('customerProfile.apellidos').trim().notEmpty().withMessage('Los apellidos son requeridos'),
    body('customerProfile.email').isEmail().withMessage('Email inválido'),
    body('customerProfile.telefono').trim().notEmpty().withMessage('El teléfono es requerido'),
    body('items').isArray({ min: 1 }).withMessage('Debe incluir al menos un ítem'),
    body('items.*.productId').isMongoId().withMessage('ID de producto inválido'),
    body('items.*.variantId').optional().isMongoId().withMessage('ID de variante inválido'),
    body('items.*.quantity').isInt({ gt: 0 }).withMessage('La cantidad debe ser mayor a 0'),
    body('shippingAddress').isObject().withMessage('La dirección de envío es requerida'),
    body('shippingAddress.departamento').notEmpty().withMessage('Departamento requerido'),
    body('shippingAddress.provincia').notEmpty().withMessage('Provincia requerido'),
    body('shippingAddress.distrito').notEmpty().withMessage('Distrito requerido'),
    body('shippingAddress.direccion').notEmpty().withMessage('Dirección requerida'),
    body('shippingMethod').optional().isString().trim(),
];

const validateStatusUpdate = [
    validateMongoId,
    body('status')
        .isIn([
            'awaiting_payment',
            'processing',
            'shipped',
            'delivered',
            'canceled',
            'paid_but_out_of_stock',
        ])
        .withMessage('Estado inválido'),
    body('reason').optional().isString().trim().isLength({ max: 200 }).withMessage('El motivo no puede exceder 200 caracteres')
];

const validateTrackingUpdate = [
    validateMongoId,
    body('trackingNumber').trim().notEmpty().withMessage('El número de tracking es requerido'),
];

const validateNoteUpdate = [
    validateMongoId,
    body('notes')
        .trim()
        .notEmpty().withMessage('La nota no puede estar vacía')
        .isLength({ max: 300 }).withMessage('La nota no puede superar los 300 caracteres'),
];

const validateCancelOrder = [
    validateMongoId,
    body('reason').optional().isString().trim().isLength({ max: 200 }).withMessage('El motivo no puede exceder 200 caracteres')
];

const validateRefundOrder = [
    validateMongoId,
    body('reason').optional().isString().trim().isLength({ max: 200 }).withMessage('El motivo del reembolso no puede exceder los 200 caracteres')
];

// ════════════════════════════════════════════════════════════════════════════════
// WEBHOOKS — sin JWT
// ════════════════════════════════════════════════════════════════════════════════

router.post('/webhooks/mercadopago', orderController.mercadoPagoWebhook);

// ════════════════════════════════════════════════════════════════════════════════
// RUTAS ESTÁTICAS PÚBLICAS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /orders/number/:orderNumber/status
 */
router.get('/number/:orderNumber/status', orderController.getOrderStatusByNumber);

/**
 * GET /orders/number/:orderNumber
 */
router.get('/number/:orderNumber', optionalAuthenticate, orderController.getOrderByNumber);

/**
 * GET /orders/guest?email=...
 */
router.get(
    '/guest',
    [query('email').isEmail().withMessage('Se requiere un email válido')],
    orderController.getGuestOrders
);

/**
 * GET /orders/my
 */
router.get('/my', authenticate, orderController.getMyOrders);

// ════════════════════════════════════════════════════════════════════════════════
// RUTAS ADMIN
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /orders/admin/all
 */
router.get('/admin/all', authenticate, isAdminOrVendedor, orderController.getAllOrders);

/**
 * GET /orders/admin/stats
 */
router.get('/admin/stats', authenticate, isAdmin, orderController.getStats);

/**
 * PATCH /orders/admin/:id/status
 */
router.patch(
    '/admin/:id/status',
    authenticate,
    isAdmin,
    validateStatusUpdate,
    orderController.updateOrderStatus
);

/**
 * PATCH /orders/admin/:id/tracking
 */
router.patch(
    '/admin/:id/tracking',
    authenticate,
    isAdmin,
    validateTrackingUpdate,
    orderController.assignTracking
);

/**
 * PATCH /orders/admin/:id/refund
 */
router.patch(
    '/admin/:id/refund',
    authenticate,
    isAdmin,
    validateRefundOrder,
    orderController.refundOrder
);

/**
 * PATCH /orders/admin/:id/notes
 */
router.patch(
    '/admin/:id/notes',
    authenticate,
    isAdminOrVendedor,
    validateNoteUpdate,
    orderController.updateNote
);

// ════════════════════════════════════════════════════════════════════════════════
// RUTAS CON PARÁMETRO DINÁMICO
// ════════════════════════════════════════════════════════════════════════════════

/**
 * POST /orders
 */
router.post('/', optionalAuthenticate, validateCreateOrder, orderController.createOrder);

/**
 * PATCH /orders/:id/cancel
 */
router.patch(
    '/:id/cancel',
    authenticate,
    validateCancelOrder,
    orderController.cancelOrder
);

/**
 * GET /orders/:id
 */
router.get(
    '/:id',
    authenticate,
    [validateMongoId],
    orderController.getOrderById
);

export default router;