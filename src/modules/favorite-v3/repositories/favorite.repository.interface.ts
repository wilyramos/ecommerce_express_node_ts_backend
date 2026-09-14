// File: backend/src/modules/favorite-v3/repositories/favorite.repository.interface.ts
import { IFavorite } from '../favorito.model';

export interface IFavoriteRepository {
    findByUser(userId: string): Promise<IFavorite[]>;
    findByUserAndProduct(userId: string, productId: string): Promise<IFavorite | null>;
    add(userId: string, productId: string): Promise<IFavorite>;
    remove(userId: string, productId: string): Promise<void>;
    addMany(userId: string, productIds: string[]): Promise<void>;
}