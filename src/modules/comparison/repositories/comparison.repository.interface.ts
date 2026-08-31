// backend/src/modules/comparison/repositories/comparison.repository.interface.ts

import { FilterQuery, UpdateQuery } from 'mongoose';
import { IComparison } from '../comparison.model';

export interface IComparisonRepository {
    findById(id: string): Promise<IComparison | null>;
    findBySlug(slug: string): Promise<IComparison | null>;
    findByProductId(productId: string): Promise<IComparison[]>;
    findAllPaginated(
        query: FilterQuery<IComparison>,
        page: number,
        limit: number
    ): Promise<{ data: IComparison[]; total: number }>;
    create(data: Partial<IComparison>): Promise<IComparison>;
    update(id: string, data: UpdateQuery<IComparison>): Promise<IComparison | null>;
    softDelete(id: string): Promise<IComparison | null>;
    incrementViewCount(id: string): Promise<void>;
}