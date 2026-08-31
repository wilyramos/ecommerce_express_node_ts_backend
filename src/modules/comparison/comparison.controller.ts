// backend/src/modules/comparison/comparison.controller.ts

import { Request, Response } from 'express';
import { comparisonService } from './comparison.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { catchAsync } from '../../utils/catchAsync';

export const comparisonController = {
    getAllPublic: catchAsync(async (req: Request, res: Response) => {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const search = (req.query.search as string) || '';

        const { data, total } = await comparisonService.getAllComparisons(page, limit, search, true);
        ApiResponse.paginated(res, data, total, page, limit, 200, 'Comparativas obtenidas exitosamente');
    }),

    getBySlug: catchAsync(async (req: Request, res: Response) => {
        const comparison = await comparisonService.getComparisonBySlug(req.params.slug, true);
        ApiResponse.success(res, 200, 'Detalle de comparativa obtenido', comparison);
    }),

    getByProduct: catchAsync(async (req: Request, res: Response) => {
        const comparisons = await comparisonService.getComparisonsByProduct(req.params.productId);
        ApiResponse.success(res, 200, 'Comparativas relacionadas obtenidas', comparisons);
    }),

    create: catchAsync(async (req: Request, res: Response) => {
        const comparison = await comparisonService.createComparison(req.body);
        ApiResponse.success(res, 201, 'Comparativa creada exitosamente', comparison);
    }),

    update: catchAsync(async (req: Request, res: Response) => {
        const comparison = await comparisonService.updateComparison(req.params.id, req.body);
        ApiResponse.success(res, 200, 'Comparativa actualizada correctamente', comparison);
    }),

    getAllAdmin: catchAsync(async (req: Request, res: Response) => {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const search = (req.query.search as string) || '';

        const { data, total } = await comparisonService.getAllComparisons(page, limit, search, false);
        ApiResponse.paginated(res, data, total, page, limit, 200, 'Gestión de comparativas obtenida');
    }),

    getById: catchAsync(async (req: Request, res: Response) => {
        const comparison = await comparisonService.getComparisonById(req.params.id);
        ApiResponse.success(res, 200, 'Comparativa obtenida', comparison);
    }),

    toggleStatus: catchAsync(async (req: Request, res: Response) => {
        const comparison = await comparisonService.toggleStatus(req.params.id);
        ApiResponse.success(
            res,
            200,
            `Comparativa ${comparison?.isActive ? 'activada' : 'desactivada'} correctamente`,
            comparison
        );
    }),

    toggleFeatured: catchAsync(async (req: Request, res: Response) => {
        const comparison = await comparisonService.toggleFeatured(req.params.id);
        ApiResponse.success(
            res,
            200,
            `Comparativa ${comparison?.isFeatured ? 'destacada' : 'removida de destacados'}`,
            comparison
        );
    }),

    delete: catchAsync(async (req: Request, res: Response) => {
        await comparisonService.deleteComparison(req.params.id);
        ApiResponse.success(res, 200, 'Comparativa eliminada correctamente');
    }),
};