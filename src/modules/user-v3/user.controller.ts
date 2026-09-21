// File: backend/src/modules/user-v3/user.controller.ts
import { Request, Response } from 'express';
import { UserService } from './user.service';
import { UserRepository } from './repositories/user.repository';
import { ApiResponse } from '../../utils/ApiResponse';
import { catchAsync } from '../../utils/catchAsync';
import { UserFiltersQuery } from './user.schema';

const userRepository = new UserRepository();
const userService = new UserService(userRepository);

export const userController = {
    // Rutas de Perfil (Propias del usuario autenticado)
    getProfile: catchAsync(async (req: Request, res: Response) => {
        const userId = (req as any).user.id;
        const profile = await userService.getProfile(userId);
        ApiResponse.success(res, 200, 'Perfil obtenido', profile);
    }),

    updateProfile: catchAsync(async (req: Request, res: Response) => {
        const userId = (req as any).user.id;
        const profile = await userService.updateProfile(userId, req.body);
        ApiResponse.success(res, 200, 'Perfil actualizado correctamente', profile);
    }),

    // Rutas de Administración
    getAll: catchAsync(async (req: Request, res: Response) => {
        const filters = req.query as unknown as UserFiltersQuery;
        const { data, total, page, limit } = await userService.getPaginatedUsers(filters);
        ApiResponse.paginated(res, data, total, page, limit, 200, 'Usuarios obtenidos');
    }),

    getById: catchAsync(async (req: Request, res: Response) => {
        const user = await userService.getUserById(req.params.id);
        ApiResponse.success(res, 200, 'Usuario obtenido', user);
    }),

    create: catchAsync(async (req: Request, res: Response) => {
        const user = await userService.createUser(req.body);
        ApiResponse.success(res, 201, 'Usuario creado exitosamente', user);
    }),

    update: catchAsync(async (req: Request, res: Response) => {
        const user = await userService.updateUser(req.params.id, req.body);
        ApiResponse.success(res, 200, 'Usuario actualizado exitosamente', user);
    }),

    toggleStatus: catchAsync(async (req: Request, res: Response) => {
        const user = await userService.toggleStatus(req.params.id);
        ApiResponse.success(res, 200, `Usuario ${user?.isActive ? 'activado' : 'desactivado'} correctamente`, user);
    }),

    delete: catchAsync(async (req: Request, res: Response) => {
        await userService.deleteUser(req.params.id);
        ApiResponse.success(res, 200, 'Usuario eliminado correctamente');
    })
};