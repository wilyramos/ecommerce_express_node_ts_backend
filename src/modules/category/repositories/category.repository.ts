// File: backend/src/modules/category/repositories/category.repository.ts
import CategoryModel, { ICategory } from '../../../models/Category';
import ProductModel from '../../../models/Product';
import { ICategoryRepository } from './category.repository.interface';
import mongoose from 'mongoose';

export class CategoryRepository implements ICategoryRepository {
    async create(data: Partial<ICategory>): Promise<ICategory> {
        return await CategoryModel.create(data);
    }

    async findById(id: string): Promise<ICategory | null> {
        return await CategoryModel.findOne({ _id: id, deletedAt: null }).lean();
    }

    async findBySlug(slug: string): Promise<ICategory | null> {
        return await CategoryModel.findOne({ slug, deletedAt: null }).lean();
    }

    async findByNameOrSlug(name: string, slug: string): Promise<ICategory | null> {
        return await CategoryModel.findOne({
            $or: [{ nombre: name }, { slug }],
            deletedAt: null,
        }).lean();
    }

    async findAll(filter: Record<string, unknown> = {}): Promise<ICategory[]> {
        return await CategoryModel.find({ ...filter, deletedAt: null })
            .sort({ order: 1, createdAt: 1 })
            .lean();
    }

    async findByParentId(parentId: string): Promise<ICategory[]> {
        return await CategoryModel.find({ parent: parentId, deletedAt: null }).lean();
    }

    async findActiveChildrenForCategories(ids: string[]): Promise<ICategory[]> {
        const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));
        return await CategoryModel.find({
            parent: { $in: objectIds },
            deletedAt: null,
        }).lean();
    }

    async update(id: string, data: Partial<ICategory>): Promise<ICategory | null> {
        return await CategoryModel.findOneAndUpdate({ _id: id, deletedAt: null }, data, { new: true }).lean();
    }

    async updateOrderBatch(items: { id: string; order: number; parent?: string | null }[]): Promise<void> {
        const bulkOps = items.map((item) => ({
            updateOne: {
                filter: { _id: item.id },
                update: {
                    $set: {
                        order: item.order,
                        parent: item.parent ? new mongoose.Types.ObjectId(item.parent) : null,
                    },
                },
            },
        }));
        await CategoryModel.bulkWrite(bulkOps);
    }

    async bulkUpdateStatus(ids: string[], isActive: boolean): Promise<number> {
        const result = await CategoryModel.updateMany(
            { _id: { $in: ids }, deletedAt: null },
            { $set: { isActive } }
        );
        return result.modifiedCount;
    }

    async softDelete(id: string): Promise<ICategory | null> {
        return await CategoryModel.findOneAndUpdate(
            { _id: id, deletedAt: null },
            { $set: { deletedAt: new Date(), isActive: false } },
            { new: true }
        ).lean();
    }

    async bulkSoftDelete(ids: string[]): Promise<number> {
        const result = await CategoryModel.updateMany(
            { _id: { $in: ids }, deletedAt: null },
            { $set: { deletedAt: new Date(), isActive: false } }
        );
        return result.modifiedCount;
    }

    async countProductsByCategoryIds(categoryIds: string[]): Promise<number> {
        const objectIds = categoryIds.map((id) => new mongoose.Types.ObjectId(id));
        return await ProductModel.countDocuments({
            categoria: { $in: objectIds },
            deletedAt: null,
        });
    }
}