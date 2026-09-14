// File: backend/src/modules/favorite-v3/favorite.controller.ts
import { Request, Response } from 'express';
import { FavoriteService } from './favorite.service';
import { FavoriteRepository } from './repositories/favorite.repository';
import { ApiResponse } from '../../utils/ApiResponse';
import { catchAsync } from '../../utils/catchAsync';

const favoriteRepository = new FavoriteRepository();
const favoriteService = new FavoriteService(favoriteRepository);

export const favoriteController = {
    toggle: catchAsync(async (req: Request, res: Response) => {
        const userId = req.user.id; // Asumiendo que `authorize` middleware inyecta `req.user`
        const { productId } = req.body;
        
        const result = await favoriteService.toggleFavorite(userId, productId);
        ApiResponse.success(res, 200, 'Favorito actualizado', result);
    }),

    sync: catchAsync(async (req: Request, res: Response) => {
        const userId = req.user.id;
        const { productIds } = req.body; // Array de IDs locales

        const mergedIds = await favoriteService.syncFavorites(userId, productIds || []);
        ApiResponse.success(res, 200, 'Favoritos sincronizados', mergedIds);
    }),

    getMine: catchAsync(async (req: Request, res: Response) => {
        const userId = req.user.id;
        const favorites = await favoriteService.getUserFavorites(userId);
        ApiResponse.success(res, 200, 'Favoritos obtenidos', favorites);
    })
};