// comparison.controller.ts

import { Request, Response, NextFunction } from 'express';
import { ComparisonService } from './comparison.service';

export class ComparisonController {

    static async create(req: Request, res: Response, next: NextFunction) {
        try {
            const comparison = await ComparisonService.create(req.body);
            res.status(201).json({ status: 'success', data: comparison });
        } catch (e) { next(e); }
    }

    static async getAll(req: Request, res: Response, next: NextFunction) {
        try {
            const { isActive, isFeatured, search, page, limit } = req.query;

            const result = await ComparisonService.getAll({
                isActive:   isActive   !== undefined ? isActive   === 'true' : undefined,
                isFeatured: isFeatured !== undefined ? isFeatured === 'true' : undefined,
                search:     search as string,
                page:       page  ? Number(page)  : undefined,
                limit:      limit ? Number(limit) : undefined
            });

            res.status(200).json({ status: 'success', ...result });
        } catch (e) { next(e); }
    }

    static async getBySlug(req: Request, res: Response, next: NextFunction) {
        try {
            const comparison = await ComparisonService.getBySlug(req.params.slug);
            res.status(200).json({ status: 'success', data: comparison });
        } catch (e) { next(e); }
    }

    static async getById(req: Request, res: Response, next: NextFunction) {
        try {
            const comparison = await ComparisonService.getById(req.params.id);
            res.status(200).json({ status: 'success', data: comparison });
        } catch (e) { next(e); }
    }

    static async update(req: Request, res: Response, next: NextFunction) {
        try {
            const comparison = await ComparisonService.update(req.params.id, req.body);
            res.status(200).json({ status: 'success', data: comparison });
        } catch (e) { next(e); }
    }

    static async delete(req: Request, res: Response, next: NextFunction) {
        try {
            await ComparisonService.delete(req.params.id);
            res.status(200).json({ status: 'success', message: 'Comparativa eliminada.' });
        } catch (e) { next(e); }
    }

    static async getRelatedToProduct(req: Request, res: Response, next: NextFunction) {
        try {
            const { productId } = req.params;
            const limit = req.query.limit ? Number(req.query.limit) : undefined;
            const data  = await ComparisonService.getRelatedToProduct(productId, limit);
            res.status(200).json({ status: 'success', data });
        } catch (e) { next(e); }
    }
}