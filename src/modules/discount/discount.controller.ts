// File: backend/src/modules/discount/discount.controller.ts

import { Request, Response } from 'express';
import { discountService } from './discount.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { catchAsync } from '../../utils/catchAsync';

export const discountController = {
    // ── EVALUACIÓN AUTOMÁTICA EN CARRITO ──────────────────
    evaluateAutomatic: catchAsync(async (req: Request, res: Response) => {
        const { subtotal, cartItems } = req.body;
        const result = await discountService.evaluateAutomaticDiscounts(
            Number(subtotal),
            cartItems
        );
        ApiResponse.success(
            res,
            200,
            'Evaluación de promociones automáticas completada',
            result
        );
    }),

    // ── PROMOCIONES AUTOMÁTICAS POR PRODUCTO ──────────────
    getProductAutomaticDiscounts: catchAsync(async (req: Request, res: Response) => {
        const { productId } = req.params;
        const discounts = await discountService.getAutomaticDiscountsForProduct(productId);
        ApiResponse.success(res, 200, 'Promociones automáticas obtenidas', discounts);
    }),

    // ── VALIDACIÓN MANUAL POR CÓDIGO (CHECKOUT) ─────────────
    validateCoupon: catchAsync(async (req: Request, res: Response) => {
        const { code, subtotal, cartItems, userId } = req.body;
        const result = await discountService.validateAndCalculateDiscount(
            code,
            Number(subtotal),
            cartItems,
            userId
        );
        ApiResponse.success(res, 200, 'Cupón válido y calculated', result);
    }),

    // ── CRUD ADMINISTRATIVO ─────────────────────────────
    create: catchAsync(async (req: Request, res: Response) => {
        console.log('req.body', req.body);
        const discount = await discountService.createDiscount(req.body);
        ApiResponse.success(res, 201, 'Descuento o cupón creado exitosamente', discount);
    }),

    // En backend/src/modules/discount/discount.controller.ts

    getById: catchAsync(async (req: Request, res: Response) => {
        const discount = await discountService.getDiscountById(req.params.id);
        ApiResponse.success(res, 200, 'Detalle del descuento obtenido correctamente', discount);
    }),

    getAll: catchAsync(async (req: Request, res: Response) => {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const search = (req.query.search as string) || '';

        const { data, total } = await discountService.getAllDiscounts(page, limit, search);
        ApiResponse.paginated(res, data, total, page, limit, 200, 'Cupones y promociones obtenidos');
    }),

    toggleStatus: catchAsync(async (req: Request, res: Response) => {
        const discount = await discountService.toggleDiscountStatus(req.params.id);
        ApiResponse.success(
            res,
            200,
            `Promoción ${discount.isActive ? 'activada' : 'desactivada'} correctamente`,
            discount
        );
    }),

    delete: catchAsync(async (req: Request, res: Response) => {
        await discountService.deleteDiscount(req.params.id);
        ApiResponse.success(res, 200, 'Descuento eliminado permanentemente');
    }),

    // ── REPORTE Y ANALÍTICA ──────────────────────────────
    getAnalytics: catchAsync(async (req: Request, res: Response) => {
        const analytics = await discountService.getDiscountAnalytics(req.params.code);
        ApiResponse.success(res, 200, 'Reporte de auditoría generado correctamente', analytics);
    }),
};