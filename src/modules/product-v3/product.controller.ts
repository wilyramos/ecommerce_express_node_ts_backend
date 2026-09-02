// backend/src/modules/product/product.controller.ts
import { Request, Response, NextFunction } from 'express';
import { ProductService } from './product.service';

export class ProductController {
    constructor(private readonly productService: ProductService) {}

    searchAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            console.log('[ProductController.searchAdmin] Query params recibidos:', req.query);

            const term = req.query.q as string;
            const limit = req.query.limit as string;

            console.log('[ProductController.searchAdmin] Parsing:', { term, limit });

            const results = await this.productService.searchAdmin(term, limit);

            console.log(`[ProductController.searchAdmin] Resultados obtenidos: ${results.length}`);

            res.status(200).json({
                success: true,
                data: results
            });
        } catch (error) {
            console.error('[ProductController.searchAdmin] Error capturado:', error);
            next(error);
        }
    };
}