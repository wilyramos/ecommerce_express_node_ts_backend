// backend/src/modules/discount/repositories/discount.repository.ts

import { ClientSession, FilterQuery, Types } from 'mongoose';
import Discount, { IDiscount } from '../discount.model';
import { IDiscountRepository } from './discount.repository.interface';

export class DiscountRepository implements IDiscountRepository {
    async findById(id: string, session?: ClientSession): Promise<IDiscount | null> {
        if (!Types.ObjectId.isValid(id)) return null;
        return await Discount.findById(id).session(session || null);
    }

    async findByCode(code: string, session?: ClientSession): Promise<IDiscount | null> {
        const cleanCode = code.trim();
        return await Discount.findOne({
            $or: [
                { code: { $regex: `^${cleanCode}$`, $options: 'i' } },
                { title: { $regex: `^${cleanCode}$`, $options: 'i' } },
            ],
        }).session(session || null);
    }

    async findActiveAutomaticDiscounts(): Promise<IDiscount[]> {
        const now = new Date();
        return await Discount.find({
            isActive: true,
            appliesVia: 'AUTOMATIC',
            startDate: { $lte: now },
            $or: [{ endDate: null }, { endDate: { $gte: now } }],
        }).sort({ createdAt: -1 });
    }

    async findActiveByCode(code: string): Promise<IDiscount | null> {
        const cleanCode = code.trim();
        return await Discount.findOne({
            $or: [
                { code: { $regex: `^${cleanCode}$`, $options: 'i' } },
                { title: { $regex: `^${cleanCode}$`, $options: 'i' } },
            ],
            isActive: true,
        });
    }

    async findAllPaginated(
        query: FilterQuery<IDiscount>,
        page: number,
        limit: number
    ): Promise<{ data: IDiscount[]; total: number }> {
        const total = await Discount.countDocuments(query);
        const data = await Discount.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        return { data, total };
    }

    async create(data: Partial<IDiscount>): Promise<IDiscount> {
        return await Discount.create(data);
    }

    async deleteById(id: string): Promise<IDiscount | null> {
        return await Discount.findByIdAndDelete(id);
    }

    async save(discount: IDiscount): Promise<IDiscount> {
        return await discount.save();
    }

    // Incrementar uso garantizado por _id
    async incrementUsageById(
        discountId: string,
        userId: string,
        existsForUser: boolean,
        session?: ClientSession
    ): Promise<void> {
        const filterQuery = { _id: new Types.ObjectId(discountId) };

        if (existsForUser) {
            await Discount.updateOne(
                { ...filterQuery, 'usedBy.userId': userId },
                {
                    $inc: {
                        currentUsageCount: 1,
                        'usedBy.$.count': 1,
                    },
                },
                { session }
            );
        } else {
            await Discount.updateOne(
                filterQuery,
                {
                    $inc: { currentUsageCount: 1 },
                    $push: { usedBy: { userId, count: 1 } },
                },
                { session }
            );
        }
    }

    // Decrementar uso garantizado por _id
    async decrementUsageById(
        discountId: string,
        userId: string,
        session?: ClientSession
    ): Promise<void> {
        await Discount.updateOne(
            {
                _id: new Types.ObjectId(discountId),
                'usedBy.userId': userId,
            },
            {
                $inc: {
                    currentUsageCount: -1,
                    'usedBy.$.count': -1,
                },
            },
            { session }
        );
    }
}