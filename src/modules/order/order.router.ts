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
    body('shippingAddress.provincia').notEmpty().withMessage('Provincia requerida'),
    body('shippingAddress.distrito').notEmpty().withMessage('Distrito requerido'),
    body('shippingAddress.direccion').notEmpty().withMessage('Dirección requerida'),
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

// ════════════════════════════════════════════════════════════════════════════════
// WEBHOOKS — sin JWT, van primero para evitar conflictos de parsing
// ════════════════════════════════════════════════════════════════════════════════

router.post('/webhooks/mercadopago', orderController.mercadoPagoWebhook);

// ════════════════════════════════════════════════════════════════════════════════
// RUTAS ESTÁTICAS PÚBLICAS
// Todas las rutas con segmentos fijos deben ir ANTES de cualquier /:id o /:param
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /orders/number/:orderNumber/status
 * Polling ligero para el checkout. Sin autenticación.
 * IMPORTANTE: debe ir antes de /number/:orderNumber
 */
router.get('/number/:orderNumber/status', orderController.getOrderStatusByNumber);

/**
 * GET /orders/number/:orderNumber
 * Consulta pública completa de una orden por su número comercial.
 */
router.get('/number/:orderNumber', optionalAuthenticate, orderController.getOrderByNumber);

/**
 * GET /orders/guest?email=...
 * Historial de órdenes de invitado por correo.
 */
router.get(
    '/guest',
    [query('email').isEmail().withMessage('Se requiere un email válido')],
    orderController.getGuestOrders
);

/**
 * GET /orders/my
 * Historial de órdenes del usuario autenticado.
 */
router.get('/my', authenticate, orderController.getMyOrders);

// ════════════════════════════════════════════════════════════════════════════════
// RUTAS ADMIN — antes de /:id
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /orders/admin/all
 * Listado de todas las órdenes con filtros.
 * Query params: status, paymentStatus, email, userId, orderNumber, from, to, page, limit
 */
router.get('/admin/all', authenticate, isAdminOrVendedor, orderController.getAllOrders);

/**
 * GET /orders/admin/stats
 * Estadísticas globales de órdenes.
 * Query params: from, to (fechas ISO opcionales)
 */
router.get('/admin/stats', authenticate, isAdmin, orderController.getStats);

/**
 * PATCH /orders/admin/:id/status
 * Cambio manual del estado logístico de una orden.
 * Body: { status: OrderStatus }
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
 * Asigna número de tracking y marca la orden como SHIPPED.
 * Body: { trackingNumber: string }
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
 * Marca la orden como reembolsada.
 * Requiere gestión manual del reembolso en la pasarela de pago.
 */
router.patch(
    '/admin/:id/refund',
    authenticate,
    isAdmin,
    [validateMongoId],
    orderController.refundOrder
);

/**
 * PATCH /orders/admin/:id/notes
 * Agrega o actualiza nota interna de gestión sobre la orden.
 * Body: { notes: string }
 */
router.patch(
    '/admin/:id/notes',
    authenticate,
    isAdminOrVendedor,
    validateNoteUpdate,
    orderController.updateNote
);

// ════════════════════════════════════════════════════════════════════════════════
// RUTAS CON PARÁMETRO DINÁMICO — siempre al final
// ════════════════════════════════════════════════════════════════════════════════

/**
 * POST /orders
 * Crear una orden nueva. Soporta invitado y usuario registrado.
 */
router.post('/', optionalAuthenticate, validateCreateOrder, orderController.createOrder);

/**
 * PATCH /orders/:id/cancel
 * Cancelar una orden. El cliente solo puede cancelar la suya; admin puede cualquiera.
 */
router.patch(
    '/:id/cancel',
    authenticate,
    [validateMongoId],
    orderController.cancelOrder
);

/**
 * GET /orders/:id
 * Detalle de una orden por ObjectId. Solo el propietario o admin.
 */
router.get(
    '/:id',
    authenticate,
    [validateMongoId],
    orderController.getOrderById
);

export default router;