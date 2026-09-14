// File: backend/src/modules/favorite-v3/repositories/favorite.repository.ts
import FavoriteModel, { IFavorite } from '../favorito.model';
import { IFavoriteRepository } from './favorite.repository.interface';
import mongoose from 'mongoose';

export class FavoriteRepository implements IFavoriteRepository {
    async findByUser(userId: string): Promise<IFavorite[]> {
        return await FavoriteModel.find({ user: userId }).lean();
    }

    async findByUserAndProduct(userId: string, productId: string): Promise<IFavorite | null> {
        return await FavoriteModel.findOne({ user: userId, product: productId }).lean();
    }

    async add(userId: string, productId: string): Promise<IFavorite> {
        return await FavoriteModel.create({ user: userId, product: productId });
    }

    async remove(userId: string, productId: string): Promise<void> {
        await FavoriteModel.deleteOne({ user: userId, product: productId });
    }

    async addMany(userId: string, productIds: string[]): Promise<void> {
        const operations = productIds.map(productId => ({
            updateOne: {
                filter: { user: userId, product: productId },
                update: { $setOnInsert: { user: userId, product: productId } },
                upsert: true
            }
        }));

        if (operations.length > 0) {
            await FavoriteModel.bulkWrite(operations);
        }
    }
}