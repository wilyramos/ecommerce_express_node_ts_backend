// File: backend/src/modules/category/repositories/category.repository.interface.ts
import { ICategory } from '../../../models/Category';

export interface ICategoryRepository {
    create(data: Partial<ICategory>): Promise<ICategory>;
    findById(id: string): Promise<ICategory | null>;
    findBySlug(slug: string): Promise<ICategory | null>;
    findByNameOrSlug(name: string, slug: string): Promise<ICategory | null>;
    findAll(filter?: Record<string, unknown>): Promise<ICategory[]>;
    findByParentId(parentId: string): Promise<ICategory[]>;
    findActiveChildrenForCategories(ids: string[]): Promise<ICategory[]>;
    update(id: string, data: Partial<ICategory>): Promise<ICategory | null>;
    updateOrderBatch(items: { id: string; order: number; parent?: string | null }[]): Promise<void>;
    bulkUpdateStatus(ids: string[], isActive: boolean): Promise<number>;
    softDelete(id: string): Promise<ICategory | null>;
    bulkSoftDelete(ids: string[]): Promise<number>;
    countProductsByCategoryIds(categoryIds: string[]): Promise<number>;
}