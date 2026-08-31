// File: backend/src/modules/category/category.service.ts
import { AppError } from '../../utils/AppError';
import { ICategoryRepository } from './repositories/category.repository.interface';
import { ICategory } from '../../models/Category';

export class CategoryService {
    constructor(private readonly categoryRepository: ICategoryRepository) {}

    private generateSlug(text: string): string {
        return text.toLowerCase().trim().replace(/[\s\W-]+/g, '-').replace(/^-+|-+$/g, '');
    }

    async createCategory(data: Partial<ICategory>) {
        const slug = data.slug || this.generateSlug(data.nombre!);
        const existing = await this.categoryRepository.findByNameOrSlug(data.nombre!, slug);
        if (existing) {
            throw new AppError('Ya existe una categoría con este nombre o slug activo.', 400);
        }

        if (data.parent) {
            const parentCat = await this.categoryRepository.findById(data.parent.toString());
            if (!parentCat) throw new AppError('La categoría padre especificada no existe.', 404);
        }

        return await this.categoryRepository.create({ ...data, slug });
    }

    async updateCategory(id: string, data: Partial<ICategory>) {
        const category = await this.categoryRepository.findById(id);
        if (!category) throw new AppError('Categoría no encontrada.', 404);

        let newSlug = category.slug;
        if (data.nombre && !data.slug) {
            newSlug = this.generateSlug(data.nombre);
        } else if (data.slug) {
            newSlug = this.generateSlug(data.slug);
        }

        if (data.nombre || newSlug !== category.slug) {
            const existing = await this.categoryRepository.findByNameOrSlug(data.nombre || category.nombre, newSlug!);
            if (existing && existing._id.toString() !== id) {
                throw new AppError('El nombre o slug generado ya está en uso.', 400);
            }
        }

        if (data.parent && data.parent.toString() === id) {
            throw new AppError('Una categoría no puede ser padre de sí misma.', 400);
        }

        return await this.categoryRepository.update(id, { ...data, slug: newSlug });
    }

    async toggleCategoryStatus(id: string) {
        const category = await this.categoryRepository.findById(id);
        if (!category) throw new AppError('Categoría no encontrada.', 404);
        return await this.categoryRepository.update(id, { isActive: !category.isActive });
    }

    async bulkUpdateStatus(ids: string[], isActive: boolean) {
        const count = await this.categoryRepository.bulkUpdateStatus(ids, isActive);
        return { modifiedCount: count };
    }

    async getDeletePreview(id: string) {
        const category = await this.categoryRepository.findById(id);
        if (!category) throw new AppError('Categoría no encontrada.', 404);

        const children = await this.categoryRepository.findByParentId(id);
        const productsCount = await this.categoryRepository.countProductsByCategoryIds([id]);

        return {
            canDelete: children.length === 0 && productsCount === 0,
            childrenCount: children.length,
            childrenNames: children.map((c) => c.nombre),
            productsCount,
        };
    }

    async deleteCategory(id: string) {
        const children = await this.categoryRepository.findByParentId(id);
        if (children.length > 0) {
            const childrenNames = children.map((c) => `"${c.nombre}"`).join(', ');
            throw new AppError(
                `No se puede eliminar la categoría porque tiene ${children.length} subcategoría(s) activa(s) (${childrenNames}). Reasigne o elimine primero las subcategorías.`,
                400
            );
        }

        const productsCount = await this.categoryRepository.countProductsByCategoryIds([id]);
        if (productsCount > 0) {
            throw new AppError(
                `No se puede eliminar la categoría porque contiene ${productsCount} producto(s) asociado(s). Reasigne los productos a otra categoría antes de continuar.`,
                400
            );
        }

        const deleted = await this.categoryRepository.softDelete(id);
        if (!deleted) throw new AppError('Categoría no encontrada.', 404);
        return deleted;
    }

    async bulkDelete(ids: string[]) {
        const dependentChildren = await this.categoryRepository.findActiveChildrenForCategories(ids);
        if (dependentChildren.length > 0) {
            const names = dependentChildren.map((c) => c.nombre).join(', ');
            throw new AppError(
                `No se pueden eliminar las categorías seleccionadas porque tienen subcategorías activas vinculadas (${names}).`,
                400
            );
        }

        const productsCount = await this.categoryRepository.countProductsByCategoryIds(ids);
        if (productsCount > 0) {
            throw new AppError(
                `No se pueden eliminar las categorías seleccionadas porque existen ${productsCount} producto(s) asignado(s) a ellas.`,
                400
            );
        }

        const count = await this.categoryRepository.bulkSoftDelete(ids);
        return { deletedCount: count };
    }

    async reorderCategories(items: { id: string; order: number; parent?: string | null }[]) {
        await this.categoryRepository.updateOrderBatch(items);
        return { ok: true };
    }

    async getCategoryTree() {
        const categories = await this.categoryRepository.findAll({});
        const categoryMap = new Map();
        const tree: any[] = [];

        categories.forEach((cat) => {
            categoryMap.set(cat._id.toString(), { ...cat, children: [] });
        });

        categories.forEach((cat) => {
            if (cat.parent) {
                const parent = categoryMap.get(cat.parent.toString());
                if (parent) {
                    parent.children.push(categoryMap.get(cat._id.toString()));
                }
            } else {
                tree.push(categoryMap.get(cat._id.toString()));
            }
        });

        return tree;
    }

    async getCategoryById(id: string) {
        const category = await this.categoryRepository.findById(id);
        if (!category) throw new AppError('Categoría no encontrada.', 404);
        return category;
    }

    async getCategoryBySlug(slug: string) {
        const category = await this.categoryRepository.findBySlug(slug);
        if (!category) throw new AppError('Categoría no encontrada.', 404);
        return category;
    }
}