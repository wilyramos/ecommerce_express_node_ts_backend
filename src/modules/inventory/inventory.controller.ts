// File: backend/src/modules/inventory/inventory.controller.ts

import { Request, Response, NextFunction } from 'express';
import { inventoryService } from './inventory.service';
import { ApiResponse } from '../../utils/ApiResponse';

export const inventoryController = {
    async getInventory(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const search = req.query.search as string | undefined;
            const filter = req.query.filter as 'low' | 'out' | 'all' | undefined;
            const page = Number(req.query.page) || 1;
            const limit = Number(req.query.limit) || 10;

            const result = await inventoryService.getInventory({
                search,
                filter,
                page,
                limit,
            });

            ApiResponse.paginated(
                res,
                result.items,
                result.total,
                result.page,
                result.limit,
                200,
                'Inventario obtenido exitosamente'
            );
        } catch (error) {
            next(error);
        }
    },

    async adjustStock(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { productId, variantId, newStock, reason } = req.body;
            const actionBy = (req as any).user?.email || (req as any).user?.nombre || 'Administrador';

            const data = await inventoryService.adjustStock({
                productId,
                variantId,
                newStock: Number(newStock),
                reason,
                actionBy,
            });

            ApiResponse.success(
                res,
                200,
                'Stock de inventario actualizado correctamente',
                data
            );
        } catch (error) {
            next(error);
        }
    },

    async getInventoryLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const productId = req.query.productId as string | undefined;
            const limit = Number(req.query.limit) || 50;

            const logs = await inventoryService.getInventoryLogs(productId, limit);

            ApiResponse.success(
                res,
                200,
                'Historial de auditoría de inventario obtenido',
                logs
            );
        } catch (error) {
            next(error);
        }
    },
};