// backend/src/modules/comparison/repositories/comparison.repository.ts

import { FilterQuery, Types, UpdateQuery } from 'mongoose';
import Comparison, { IComparison } from '../comparison.model';
import { IComparisonRepository } from './comparison.repository.interface';

export class ComparisonRepository implements IComparisonRepository {
    async findById(id: string): Promise<IComparison | null> {
        if (!Types.ObjectId.isValid(id)) return null;
        return await Comparison.findOne({ _id: id, deletedAt: null }).populate('products');
    }

    async findBySlug(slug: string): Promise<IComparison | null> {
        return await Comparison.findOne({ slug, deletedAt: null }).populate('products');
    }

    async findByProductId(productId: string): Promise<IComparison[]> {
        if (!Types.ObjectId.isValid(productId)) return [];
        return await Comparison.find({
            products: productId,
            deletedAt: null,
            isActive: true,
        }).populate('products');
    }

    async findAllPaginated(
        query: FilterQuery<IComparison>,
        page: number,
        limit: number
    ): Promise<{ data: IComparison[]; total: number }> {
        const activeQuery = { ...query, deletedAt: null };
        const total = await Comparison.countDocuments(activeQuery);
        const data = await Comparison.find(activeQuery)
            .populate('products')
            .sort({ isFeatured: -1, createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        return { data, total };
    }

    async create(data: Partial<IComparison>): Promise<IComparison> {
        return await Comparison.create(data);
    }

    async update(id: string, data: UpdateQuery<IComparison>): Promise<IComparison | null> {
        if (!Types.ObjectId.isValid(id)) return null;
        return await Comparison.findOneAndUpdate(
            { _id: id, deletedAt: null },
            data,
            { new: true, runValidators: true }
        ).populate('products');
    }

    async softDelete(id: string): Promise<IComparison | null> {
        if (!Types.ObjectId.isValid(id)) return null;
        return await Comparison.findOneAndUpdate(
            { _id: id, deletedAt: null },
            { deletedAt: new Date(), isActive: false },
            { new: true }
        );
    }

    async incrementViewCount(id: string): Promise<void> {
        if (!Types.ObjectId.isValid(id)) return;
        await Comparison.updateOne({ _id: id }, { $inc: { viewCount: 1 } });
    }
}