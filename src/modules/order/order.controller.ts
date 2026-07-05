// File: backend/src/modules/order/order.controller.ts

import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { orderService } from './order.service';
import { OrderStatus } from '../../models/Order';
import { AppError } from '../../utils/AppError';

// ── Helpers ──────────────────────────────────────────────────────────────────

function sendSuccess(res: Response, data: unknown, meta?: unknown): void {
    res.status(200).json({ ok: true, data, ...(meta && { meta }) });
}

function handleValidation(req: Request, res: Response): boolean {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(422).json({ ok: false, errors: errors.array() });
        return false;
    }
    return true;
}

// ── Controllers ───────────────────────────────────────────────────────────────

export const orderController = {

    // ── Público / Cliente ─────────────────────────────────────────────────────

    /**
     * POST /orders
     * Crea una orden. Soporta invitado y usuario registrado.
     */
    async createOrder(req: Request, res: Response): Promise<void> {
        if (!handleValidation(req, res)) return;
        try {
            const userId = (req as any).user?.id as string | undefined;
            
            const deviceInfo = {
                ipAddress: req.ip || req.socket.remoteAddress,
                userAgent: req.headers['user-agent']
            };

            const order = await orderService.createOrder({ 
                ...req.body, 
                userId,
                deviceInfo 
            });
            res.status(201).json({ ok: true, data: order });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Error inesperado.';
            res.status(400).json({ ok: false, message });
        }
    },

    /**
     * GET /orders/my
     * Historial de órdenes del usuario autenticado.
     */
    async getMyOrders(req: Request, res: Response): Promise<void> {
        const userId = (req as any).user?.id;
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const { orders, total } = await orderService.getOrdersByUser(userId, page, limit);
        sendSuccess(res, orders, { total, page, pages: Math.ceil(total / limit) });
    },

    /**
     * GET /orders/guest?email=...
     * Historial de órdenes de un invitado por email.
     */
    async getGuestOrders(req: Request, res: Response): Promise<void> {
        const email = req.query.email as string;
        if (!email) throw new AppError('Se requiere el parámetro email.', 400);
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const { orders, total } = await orderService.getOrdersByEmail(email, page, limit);
        sendSuccess(res, orders, { total, page, pages: Math.ceil(total / limit) });
    },

    /**
     * GET /orders/number/:orderNumber
     * Consulta pública de una orden por número comercial (ORD-...).
     */
    async getOrderByNumber(req: Request, res: Response): Promise<void> {
        const order = await orderService.getOrderByNumber(req.params.orderNumber);
        if (!order) throw new AppError('Orden no encontrada.', 404);
        sendSuccess(res, order);
    },

    /**
     * GET /orders/number/:orderNumber/status
     * Polling ligero del estado de pago para el checkout.
     */
    async getOrderStatusByNumber(req: Request, res: Response): Promise<void> {
        const { orderNumber } = req.params;
        if (!orderNumber) throw new AppError('El número de orden es requerido.', 400);
        const data = await orderService.getOrderStatusByNumber(orderNumber);
        if (!data) throw new AppError('Orden no encontrada.', 404);
        sendSuccess(res, data);
    },

    /**
     * GET /orders/:id
     * Detalle de una orden. Solo el propietario o un admin pueden acceder.
     */
    async getOrderById(req: Request, res: Response): Promise<void> {
        const order = await orderService.getOrderById(req.params.id);
        if (!order) throw new AppError('Orden no encontrada.', 404);

        const userId = (req as any).user?.id;
        const role = (req as any).user?.rol;
        const orderUserId =
            order.user && typeof order.user === 'object'
                ? (order.user as any)._id?.toString()
                : order.user?.toString();

        if (role !== 'administrador' && orderUserId !== String(userId)) {
            throw new AppError('No tienes permiso para ver esta orden.', 403);
        }

        sendSuccess(res, order);
    },

    /**
     * PATCH /orders/:id/cancel
     * Cancelación de orden por el propio cliente o admin de forma atómica.
     */
    async cancelOrder(req: Request, res: Response): Promise<void> {
        const userId = (req as any).user?.id;
        const role = (req as any).user?.rol;
        const { reason } = req.body;

        const existing = await orderService.getOrderById(req.params.id);
        if (!existing) throw new AppError('Orden no encontrada.', 404);

        if (role !== 'administrador' && String((existing as any).user) !== String(userId)) {
            throw new AppError('No tienes permiso para cancelar esta orden.', 403);
        }

        try {
            const executor = role === 'administrador' ? `admin_${userId}` : userId;
            const order = await orderService.cancelOrder(req.params.id, executor, reason);
            sendSuccess(res, order);
        } catch (error: any) {
            throw new AppError(error.message, 400);
        }
    },

    // ── Admin ─────────────────────────────────────────────────────────────────

    /**
     * GET /orders/admin/all
     */
    async getAllOrders(req: Request, res: Response): Promise<void> {
        const { status, paymentStatus, email, userId, orderNumber, page, limit, from, to } =
            req.query;

        const pageNum = Number(page) || 1;
        const limitNum = Number(limit) || 20;

        const { orders, total } = await orderService.getAllOrders({
            status: status as OrderStatus | undefined,
            paymentStatus: paymentStatus as any,
            email: email as string | undefined,
            userId: userId as string | undefined,
            orderNumber: orderNumber as string | undefined,
            page: pageNum,
            limit: limitNum,
            from: from as string | undefined,
            to: to as string | undefined,
        });

        sendSuccess(res, orders, {
            total,
            page: pageNum,
            pages: Math.ceil(total / limitNum),
        });
    },

    /**
     * PATCH /orders/admin/:id/status
     */
    async updateOrderStatus(req: Request, res: Response): Promise<void> {
        if (!handleValidation(req, res)) return;
        const adminId = (req as any).user?.id;
        const { status, reason } = req.body;

        try {
            const order = await orderService.updateOrderStatus(req.params.id, status, `admin_${adminId}`, reason);
            if (!order) throw new AppError('Orden no encontrada.', 404);
            sendSuccess(res, order);
        } catch (error: any) {
            throw new AppError(error.message, 400);
        }
    },

    /**
     * PATCH /orders/admin/:id/tracking
     */
    async assignTracking(req: Request, res: Response): Promise<void> {
        if (!handleValidation(req, res)) return;
        const adminId = (req as any).user?.id;
        const { trackingNumber } = req.body;

        try {
            const order = await orderService.assignTracking(req.params.id, trackingNumber, `admin_${adminId}`);
            if (!order) throw new AppError('Orden no encontrada.', 404);
            sendSuccess(res, order);
        } catch (error: any) {
            throw new AppError(error.message, 400);
        }
    },

    /**
     * PATCH /orders/admin/:id/refund
     */
    async refundOrder(req: Request, res: Response): Promise<void> {
        const adminId = (req as any).user?.id;
        const { reason } = req.body;
        try {
            const order = await orderService.refundOrder(req.params.id, `admin_${adminId}`, reason);
            if (!order) throw new AppError('Orden no encontrada.', 404);
            sendSuccess(res, order);
        } catch (error: any) {
            throw new AppError(error.message, 400);
        }
    },

    /**
     * PATCH /orders/admin/:id/notes
     */
    async updateNote(req: Request, res: Response): Promise<void> {
        if (!handleValidation(req, res)) return;
        const order = await orderService.updateNote(req.params.id, req.body.notes);
        if (!order) throw new AppError('Orden no encontrada.', 404);
        sendSuccess(res, order);
    },

    /**
     * GET /orders/admin/stats
     */
    async getStats(req: Request, res: Response): Promise<void> {
        const { from, to } = req.query;
        const stats = await orderService.getStats(
            from as string | undefined,
            to as string | undefined
        );
        sendSuccess(res, stats);
    },

    // ── Webhooks ──────────────────────────────────────────────────────────────

    /**
     * POST /orders/webhooks/mercadopago
     */
    async mercadoPagoWebhook(req: Request, res: Response): Promise<void> {
        const { type, data } = req.body;
        if (type !== 'payment') { res.sendStatus(200); return; }
        const paymentId = data?.id;
        if (!paymentId) { res.sendStatus(400); return; }
        const order = await orderService.getOrderByTransactionId(String(paymentId));
        if (!order) { res.sendStatus(404); return; }
        await orderService.updatePayment(String(order._id), {
            provider: 'mercadopago',
            transactionId: String(paymentId),
            status: req.body.action === 'payment.updated' ? 'approved' as any : 'pending' as any,
            rawResponse: req.body,
        });
        res.sendStatus(200);
    },
};