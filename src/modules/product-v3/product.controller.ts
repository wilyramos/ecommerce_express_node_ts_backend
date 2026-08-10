// backend/src/modules/product/product.controller.ts
import { Request, Response, NextFunction } from 'express';
import { ProductService } from './product.service';

export class ProductController {
    constructor(private readonly productService: ProductService) {}

    searchAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const term = req.query.q as string;
            const limit = req.query.limit as string;

            const results = await this.productService.searchAdmin(term, limit);

            res.status(200).json({
                success: true,
                data: results
            });
        } catch (error) {
            next(error);
        }
    };
}