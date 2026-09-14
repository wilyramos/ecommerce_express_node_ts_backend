// File: backend/src/modules/favorite-v3/favorite.service.ts
import { IFavoriteRepository } from './repositories/favorite.repository.interface';
import { AppError } from '../../utils/AppError';

export class FavoriteService {
    constructor(private readonly favoriteRepository: IFavoriteRepository) {}

    async toggleFavorite(userId: string, productId: string) {
        const existing = await this.favoriteRepository.findByUserAndProduct(userId, productId);
        
        if (existing) {
            await this.favoriteRepository.remove(userId, productId);
            return { action: 'removed', productId };
        } else {
            await this.favoriteRepository.add(userId, productId);
            return { action: 'added', productId };
        }
    }

    async syncFavorites(userId: string, localProductIds: string[]) {
        // Obtenemos los favoritos actuales de la base de datos
        const dbFavorites = await this.favoriteRepository.findByUser(userId);
        const dbIds = dbFavorites.map(f => f.product.toString());

        // Identificamos los que faltan por guardar en la BD
        const toAdd = localProductIds.filter(id => !dbIds.includes(id));
        
        if (toAdd.length > 0) {
            await this.favoriteRepository.addMany(userId, toAdd);
        }

        // Retornamos la unión de ambos arreglos para que el cliente actualice su estado
        return Array.from(new Set([...dbIds, ...localProductIds]));
    }

    async getUserFavorites(userId: string) {
        const favorites = await this.favoriteRepository.findByUser(userId);
        return favorites.map(f => f.product.toString());
    }
}