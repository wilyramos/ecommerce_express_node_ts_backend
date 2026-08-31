// File: backend/src/modules/category/category.controller.ts
import { Request, Response } from 'express';
import { CategoryService } from './category.service';
import { CategoryRepository } from './repositories/category.repository';
import { ApiResponse } from '../../utils/ApiResponse';
import { catchAsync } from '../../utils/catchAsync';

const categoryRepository = new CategoryRepository();
const categoryService = new CategoryService(categoryRepository);

export const categoryController = {
    getTree: catchAsync(async (req: Request, res: Response) => {
        const tree = await categoryService.getCategoryTree();
        ApiResponse.success(res, 200, 'Árbol de categorías obtenido exitosamente', tree);
    }),

    getById: catchAsync(async (req: Request, res: Response) => {
        const category = await categoryService.getCategoryById(req.params.id);
        ApiResponse.success(res, 200, 'Categoría obtenida', category);
    }),

    getBySlug: catchAsync(async (req: Request, res: Response) => {
        const category = await categoryService.getCategoryBySlug(req.params.slug);
        ApiResponse.success(res, 200, 'Categoría obtenida', category);
    }),

    getDeletePreview: catchAsync(async (req: Request, res: Response) => {
        const preview = await categoryService.getDeletePreview(req.params.id);
        ApiResponse.success(res, 200, 'Previsualización de dependencias obtenida', preview);
    }),

    create: catchAsync(async (req: Request, res: Response) => {
        const category = await categoryService.createCategory(req.body);
        ApiResponse.success(res, 201, 'Categoría creada exitosamente', category);
    }),

    update: catchAsync(async (req: Request, res: Response) => {
        const category = await categoryService.updateCategory(req.params.id, req.body);
        ApiResponse.success(res, 200, 'Categoría actualizada correctamente', category);
    }),

    toggleStatus: catchAsync(async (req: Request, res: Response) => {
        const category = await categoryService.toggleCategoryStatus(req.params.id);
        ApiResponse.success(res, 200, `Categoría ${category?.isActive ? 'activada' : 'desactivada'} correctamente`, category);
    }),

    bulkStatus: catchAsync(async (req: Request, res: Response) => {
        const { ids, isActive } = req.body;
        const result = await categoryService.bulkUpdateStatus(ids, isActive);
        ApiResponse.success(res, 200, `Se actualizaron ${result.modifiedCount} categorías correctamente`, result);
    }),

    bulkDelete: catchAsync(async (req: Request, res: Response) => {
        const { ids } = req.body;
        const result = await categoryService.bulkDelete(ids);
        ApiResponse.success(res, 200, `Se eliminaron ${result.deletedCount} categorías correctamente`, result);
    }),

    reorder: catchAsync(async (req: Request, res: Response) => {
        const { items } = req.body;
        const result = await categoryService.reorderCategories(items);
        ApiResponse.success(res, 200, 'Orden de categorías actualizado correctamente', result);
    }),

    delete: catchAsync(async (req: Request, res: Response) => {
        await categoryService.deleteCategory(req.params.id);
        ApiResponse.success(res, 200, 'Categoría eliminada correctamente');
    }),
};