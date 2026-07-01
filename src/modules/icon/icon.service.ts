// File: backend/src/modules/icon/icon.service.ts

import { Types } from 'mongoose';
import Icon, { IIcon } from './icon.model';
import { Media } from '../media/media.model';
import { AppError } from '../../utils/AppError';

export interface ICreateIconInput {
    key: string;
    nombre: string;
    mediaId: string;
    grupo?: string;
    order?: number;
    isActive?: boolean;
}

export interface IUpdateIconInput {
    key?: string;
    nombre?: string;
    mediaId?: string;
    grupo?: string;
    order?: number;
    isActive?: boolean;
}

export class IconService {
    static async create(input: ICreateIconInput): Promise<IIcon> {
        if (!Types.ObjectId.isValid(input.mediaId)) {
            throw new AppError('ID de Media inválido', 400);
        }

        const mediaResource = await Media.findById(input.mediaId).lean().exec();
        if (!mediaResource) {
            throw new AppError('El recurso multimedia (Media) proporcionado no existe', 404);
        }

        // Validación preventiva de duplicado activo antes del guardado
        const existingIcon = await Icon.findOne({ key: input.key.trim().toLowerCase(), deletedAt: null }).lean().exec();
        if (existingIcon) {
            throw new AppError(`La clave de ícono '${input.key}' ya está registrada y activa`, 400);
        }

        const newIcon = await Icon.create({
            key: input.key,
            nombre: input.nombre,
            mediaId: new Types.ObjectId(input.mediaId),
            iconUrl: mediaResource.secureUrl,
            grupo: input.grupo,
            order: input.order,
            isActive: input.isActive
        });

        return newIcon;
    }

    static async update(id: string, input: IUpdateIconInput): Promise<IIcon> {
        if (!Types.ObjectId.isValid(id)) {
            throw new AppError('ID de Ícono inválido', 400);
        }

        const icon = await Icon.findOne({ _id: id, deletedAt: null });
        if (!icon) {
            throw new AppError('Ícono no encontrado o eliminado', 404);
        }

        if (input.key) {
            const cleanKey = input.key.trim().toLowerCase();
            if (cleanKey !== icon.key) {
                const duplicate = await Icon.findOne({ key: cleanKey, deletedAt: null }).lean().exec();
                if (duplicate) {
                    throw new AppError(`La clave de ícono '${input.key}' ya se encuentra en uso`, 400);
                }
                icon.key = cleanKey;
            }
        }

        if (input.mediaId) {
            if (!Types.ObjectId.isValid(input.mediaId)) {
                throw new AppError('ID de Media inválido', 400);
            }
            const mediaResource = await Media.findById(input.mediaId).lean().exec();
            if (!mediaResource) {
                throw new AppError('El recurso multimedia (Media) no existe', 404);
            }
            icon.mediaId = new Types.ObjectId(input.mediaId);
            icon.iconUrl = mediaResource.secureUrl;
        }

        if (input.nombre !== undefined) icon.nombre = input.nombre;
        if (input.grupo !== undefined) icon.grupo = input.grupo;
        if (input.order !== undefined) icon.order = input.order;
        if (input.isActive !== undefined) icon.isActive = input.isActive;

        await icon.save();
        return icon;
    }

    static async listAll(includeInactive = false): Promise<IIcon[]> {
        const filter: Record<string, any> = { deletedAt: null };
        if (!includeInactive) {
            filter.isActive = true;
        }

        return Icon.find(filter)
            .sort({ grupo: 1, order: 1, nombre: 1 })
            .lean()
            .exec();
    }

    static async getById(id: string): Promise<IIcon> {
        if (!Types.ObjectId.isValid(id)) {
            throw new AppError('ID de Ícono inválido', 400);
        }

        const icon = await Icon.findOne({ _id: id, deletedAt: null }).lean().exec();
        if (!icon) {
            throw new AppError('Ícono no encontrado', 404);
        }

        return icon as IIcon;
    }

    static async deleteLogically(id: string): Promise<void> {
        if (!Types.ObjectId.isValid(id)) {
            throw new AppError('ID de Ícono inválido', 400);
        }

        const icon = await Icon.findOne({ _id: id, deletedAt: null });
        if (!icon) {
            throw new AppError('Ícono no encontrado o ya eliminado', 404);
        }

        icon.deletedAt = new Date();
        icon.isActive = false;
        await icon.save();
    }
}