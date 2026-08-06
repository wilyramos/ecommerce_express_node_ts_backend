// backend/src/modules/discount/repositories/discount.repository.interface.ts

import { ClientSession, FilterQuery } from 'mongoose';
import { IDiscount } from '../discount.model';

export interface IDiscountRepository {
    findByCode(code: string, session?: ClientSession): Promise<IDiscount | null>;
    findById(id: string, session?: ClientSession): Promise<IDiscount | null>;
    findActiveByCode(code: string): Promise<IDiscount | null>;
    findActiveAutomaticDiscounts(): Promise<IDiscount[]>;
    findAllPaginated(
        query: FilterQuery<IDiscount>,
        page: number,
        limit: number
    ): Promise<{ data: IDiscount[]; total: number }>;
    create(data: Partial<IDiscount>): Promise<IDiscount>;
    deleteById(id: string): Promise<IDiscount | null>;
    save(discount: IDiscount): Promise<IDiscount>;
    
    // Métodos para consumo por ID
    incrementUsageById(
        discountId: string,
        userId: string,
        existsForUser: boolean,
        session?: ClientSession
    ): Promise<void>;
    decrementUsageById(
        discountId: string,
        userId: string,
        session?: ClientSession
    ): Promise<void>;
}