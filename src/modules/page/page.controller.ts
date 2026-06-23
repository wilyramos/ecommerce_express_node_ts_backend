// File: backend/src/modules/page/page.controller.ts

import { Request, Response, NextFunction } from 'express';
import { PageService } from './page.service';
import { ApiResponse } from '../../utils/ApiResponse';

const pageService = new PageService();

export class PageController {
    
    getPageBySlug = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { slug } = req.params;
            const page = await pageService.getPageBySlug(slug);
            ApiResponse.success(res, 200, 'Página recuperada exitosamente para el escaparate.', page);
        } catch (error) {
            next(error);
        }
    };

    getAllPages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const page = parseInt(req.query.page as string, 10) || 1;
            const limit = parseInt(req.query.limit as string, 10) || 10;

            const result = await pageService.getAllPages(page, limit);

            ApiResponse.paginated(
                res,
                result.data,
                result.meta.total,
                result.meta.page,
                result.meta.limit,
                200,
                'Listado administrativo de páginas obtenido correctamente.'
            );
        } catch (error) {
            next(error);
        }
    };

    getPageById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params;
            const page = await pageService.getPageById(id);
            ApiResponse.success(res, 200, 'Detalle de la página obtenido correctamente.', page);
        } catch (error) {
            next(error);
        }
    };

    createPage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const newPage = await pageService.createPage(req.body);
            ApiResponse.success(res, 201, 'Página institucional creada de forma exitosa.', newPage);
        } catch (error) {
            next(error);
        }
    };

    updatePage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params;
            const updatedPage = await pageService.updatePage(id, req.body);
            ApiResponse.success(res, 200, 'Página actualizada de forma exitosa.', updatedPage);
        } catch (error) {
            next(error);
        }
    };

    deletePage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params;
            const deletedPage = await pageService.deletePage(id);
            ApiResponse.success(
                res, 
                200, 
                'Página removida permanentemente del sistema corporativo.', 
                { id: deletedPage._id }
            );
        } catch (error) {
            next(error);
        }
    };
}