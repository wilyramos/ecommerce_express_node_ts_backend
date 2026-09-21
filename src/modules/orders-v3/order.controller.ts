// File: backend/src/modules/order-v3/order.controller.ts
// ✅ VERSIÓN MEJORADA - RESPUESTA 3DS CORRECTA

import { Request, Response } from 'express';
import { OrderService } from './order.service';
import { OrderRepository } from './repositories/order.repository';
import { CulqiProvider } from '../../providers/payment/culqi.provider';
import { ApiResponse } from '../../utils/ApiResponse';
import { catchAsync } from '../../utils/catchAsync';
import { OrderFiltersQuery } from './order.schema';

const orderRepository = new OrderRepository();
const paymentProvider = new CulqiProvider();
const orderService = new OrderService(orderRepository, paymentProvider);

export const orderController = {
    checkout: catchAsync(async (req: Request, res: Response) => {
        const ipAddress = req.ip || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];
        const userId = (req as any).user?.id;

        const order = await orderService.initializeCheckout(req.body, userId, ipAddress, userAgent);
        ApiResponse.success(res, 201, 'Checkout inicializado exitosamente', order);
    }),

    charge: catchAsync(async (req: Request, res: Response) => {
        const { id } = req.params;
const {
  tokenId,
  deviceFingerPrintId,
  authentication_3DS
} = req.body;
        console.log('[OrderController] 💳 Procesando cargo:', {
            orderId: id,
            has3DSParams: !!authentication_3DS,
            tokenId: tokenId?.substring(0, 10) + '...'
        });

        try {
           const order = await orderService.processCharge(
  id,
  tokenId,
  deviceFingerPrintId,
  authentication_3DS
);
            
            console.log('[OrderController] ✅ Cargo exitoso sin 3DS requerido');
            ApiResponse.success(res, 201, 'Pago procesado exitosamente', order);

        } catch (error: any) {
            // ✅ MANEJO DE ERROR 3DS
            // Culqi lanzó excepción con is3DS = true
            if (error.is3DS === true || error.needs3DS === true || error.culqiStatus === 200) {
                console.log('[OrderController] 🔐 3DS requerido - Retornando indicador al frontend');
                
                return res.status(200).json({
                    ok: false,
                    data: {
                        needs3DS: true,
                        orderId: id,
                        totalAmount: Math.round(error.totalAmount || 0),
                        email: error.email || '',
                        message: 'Autenticación 3DS requerida'
                    }
                });
            }

            // ❌ ERROR NORMAL - Dejar que el middleware de errores lo maneje
            throw error;
        }
    }),

    webhook: catchAsync(async (req: Request, res: Response) => {
        await orderService.handleWebhook(req.body);
        res.status(200).json({ received: true });
    }),

    getByNumber: catchAsync(async (req: Request, res: Response) => {
        const order = await orderService.getOrderByNumber(req.params.orderNumber);
        ApiResponse.success(res, 200, 'Orden obtenida exitosamente', order);
    }),

    getAll: catchAsync(async (req: Request, res: Response) => {
        const filters = req.query as unknown as OrderFiltersQuery;
        const { data, total, page, limit } = await orderService.getPaginatedOrders(filters);
        ApiResponse.paginated(res, data, total, page, limit, 200, 'Órdenes obtenidas');
    }),

    getById: catchAsync(async (req: Request, res: Response) => {
        const order = await orderService.getOrderById(req.params.id);
        ApiResponse.success(res, 200, 'Detalle de orden obtenido', order);
    }),

    updateStatus: catchAsync(async (req: Request, res: Response) => {
        const { status, reason } = req.body;
        const adminId = (req as any).user?.id;

        const order = await orderService.updateOrderStatus(req.params.id, status, reason, adminId);
        ApiResponse.success(res, 200, 'Estado de la orden actualizado', order);
    })
};