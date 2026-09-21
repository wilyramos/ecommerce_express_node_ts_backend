// File: backend/src/modules/auth-v3/auth.controller.ts
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthRepository } from './repositories/auth.repository';
import { ApiResponse } from '../../utils/ApiResponse';
import { catchAsync } from '../../utils/catchAsync';
import { AppError } from '../../utils/AppError';

const authRepository = new AuthRepository();
const authService = new AuthService(authRepository);

export const authController = {
    login: catchAsync(async (req: Request, res: Response) => {
        const result = await authService.login(req.body);
        ApiResponse.success(res, 200, 'Inicio de sesión exitoso', result);
    }),

    updatePassword: catchAsync(async (req: Request, res: Response) => {
        const userId = req.user?.id || (req.user as any)?._id;
        
        if (!userId) {
            throw new AppError('No autorizado', 401);
        }

        await authService.updatePassword(userId.toString(), req.body);
        ApiResponse.success(res, 200, 'Contraseña actualizada correctamente');
    })
};