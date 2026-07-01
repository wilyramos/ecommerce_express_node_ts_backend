// File: backend/src/modules/icon/icon.controller.ts

import { Request, Response, NextFunction } from 'express';
import { IconService } from './icon.service';
import { ApiResponse } from '../../utils/ApiResponse'; // Ajustar ruta relativa según tu arquitectura
import { AppError } from '../../utils/AppError';
import { Types } from 'mongoose';

export class IconController {
    static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { key, nombre, mediaId, grupo, order, isActive } = req.body;

            if (!key || !nombre || !mediaId) {
                throw new AppError('Los campos key, nombre y mediaId son obligatorios', 400);
            }

            const newIcon = await IconService.create({
                key,
                nombre,
                mediaId,
                grupo,
                order,
                isActive,
            });

            ApiResponse.success(res, 201, 'Ícono creado exitosamente en el catálogo', newIcon);
        } catch (error) {
            next(error);
        }
    }

    static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            if (!Types.ObjectId.isValid(id)) {
                throw new AppError('ID de ícono inválido', 400);
            }

            const updatedIcon = await IconService.update(id, req.body);

            ApiResponse.success(res, 200, 'Ícono actualizado correctamente', updatedIcon);
        } catch (error) {
            next(error);
        }
    }

    static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            // Se asume parámetro opcional para ver inactivos (útil para el panel de administración)
            const includeInactive = req.query.includeInactive === 'true';
            const icons = await IconService.listAll(includeInactive);

            ApiResponse.success(res, 200, 'Listado de íconos obtenido exitosamente', icons);
        } catch (error) {
            next(error);
        }
    }

    static async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            if (!Types.ObjectId.isValid(id)) {
                throw new AppError('ID de ícono inválido', 400);
            }

            const icon = await IconService.getById(id);

            ApiResponse.success(res, 200, 'Ícono obtenido exitosamente', icon);
        } catch (error) {
            next(error);
        }
    }

    static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            if (!Types.ObjectId.isValid(id)) {
                throw new AppError('ID de ícono inválido', 400);
            }

            await IconService.deleteLogically(id);

            ApiResponse.success(res, 200, 'Ícono eliminado correctamente del catálogo');
        } catch (error) {
            next(error);
        }
    }
}