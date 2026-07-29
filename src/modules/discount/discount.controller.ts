// File: backend/src/modules/discount/discount.controller.ts
import { Request, Response, NextFunction } from 'express';
import { discountService } from './discount.service';
import { ApiResponse } from '../../utils/ApiResponse';

export const discountController = {
    // ── PUBLIC ──────────────────────────────────────────
    async validateCoupon(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { code, subtotal, cartItems, userId } = req.body;
            
            // userId puede ser el correo (si es invitado) o el MongoID si está logueado
            const result = await discountService.validateAndCalculateDiscount(code, Number(subtotal), cartItems, userId);
            
            ApiResponse.success(res, 200, 'Cupón válido y calculado', result);
        } catch (error) {
            next(error);
        }
    },

    // ── ADMIN ───────────────────────────────────────────
    async create(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const discount = await discountService.createDiscount(req.body);
            ApiResponse.success(res, 201, 'Cupón creado exitosamente', discount);
        } catch (error) {
            next(error);
        }
    },

    async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const page = Number(req.query.page) || 1;
            const limit = Number(req.query.limit) || 10;
            const search = req.query.search as string || '';

            const { data, total } = await discountService.getAllDiscounts(page, limit, search);

            ApiResponse.paginated(res, data, total, page, limit, 200, 'Cupones obtenidos');
        } catch (error) {
            next(error);
        }
    },

    async toggleStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const discount = await discountService.toggleDiscountStatus(req.params.id);
            ApiResponse.success(res, 200, `Cupón ${discount.isActive ? 'activado' : 'desactivado'} correctamente`, discount);
        } catch (error) {
            next(error);
        }
    },

    async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            await discountService.deleteDiscount(req.params.id);
            ApiResponse.success(res, 200, 'Cupón eliminado permanentemente');
        } catch (error) {
            next(error);
        }
    }
};