// backend/src/modules/comparison/comparison.controller.ts
import { Request, Response, NextFunction } from 'express';
import { ComparisonService } from './comparison.service';

export class ComparisonController {
    /**
     * POST /api/comparisons
     */
    static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const comparison = await ComparisonService.create(req.body);
            res.status(201).json({
                status: 'success',
                data: comparison
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/comparisons
     */
    static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { isActive, isFeatured, search, limit, page } = req.query;

            const filters = {
                isActive: isActive !== undefined ? isActive === 'true' : undefined,
                isFeatured: isFeatured !== undefined ? isFeatured === 'true' : undefined,
                search: search as string,
                limit: limit ? parseInt(limit as string, 10) : undefined,
                page: page ? parseInt(page as string, 10) : undefined
            };

            const result = await ComparisonService.getAll(filters);

            res.status(200).json({
                status: 'success',
                data: result.comparisons,
                total: result.total,
                page: result.page,
                pages: result.pages
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/comparisons/slug/:slug
     */
    static async getBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { slug } = req.params;
            const isPublic = req.query.isPublic !== 'false';

            const comparison = await ComparisonService.getBySlug(slug, isPublic);
            res.status(200).json({
                status: 'success',
                data: comparison
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/comparisons/:id
     */
    static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const comparison = await ComparisonService.getById(id);
            res.status(200).json({
                status: 'success',
                data: comparison
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * PUT /api/comparisons/:id
     */
    static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const comparison = await ComparisonService.update(id, req.body);
            res.status(200).json({
                status: 'success',
                data: comparison
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * DELETE /api/comparisons/:id
     */
    static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            await ComparisonService.delete(id);
            res.status(200).json({
                status: 'success',
                message: 'Comparativa eliminada correctamente.'
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/comparisons/product/:productId
     */
    static async getRelatedToProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { productId } = req.params;
            const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

            const comparisons = await ComparisonService.getRelatedToProduct(productId, limit);
            res.status(200).json({
                status: 'success',
                data: comparisons
            });
        } catch (error) {
            next(error);
        }
    }
}