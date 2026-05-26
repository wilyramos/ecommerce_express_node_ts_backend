import sharp from 'sharp';
import { v4 as uuid } from 'uuid';
import fs from 'fs/promises';
import cloudinary from '../../config/cloudinary';
import { Media, IMedia, ResourceType, MediaFolder } from './media.model';
import { AppError } from '../../utils/AppError';
import { Types } from 'mongoose';
import { MAX_IMAGE_SIZE_BYTES, MAX_VIDEO_SIZE_BYTES } from './media.constants';

interface UploadResult {
    publicId: string;
    secureUrl: string;
    format: string;
    bytes: number;
    width?: number;
    height?: number;
    duration?: number;
    resourceType: ResourceType;
}

export class MediaService {
    private static async cleanupTemp(filepath: string): Promise<void> {
        try {
            await fs.unlink(filepath);
        } catch {
            // Archivo ya eliminado o inexistente
        }
    }

    static extractPublicId(secureUrl: string): string {
        const match = secureUrl.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?$/i);
        if (!match) throw new AppError('URL de Cloudinary inválida', 400);
        return match[1];
    }

    private static assertCloudinaryUrl(url: string): void {
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        if (!url.includes(`res.cloudinary.com/${cloudName}`)) {
            throw new AppError('URL no pertenece a tu instancia de Cloudinary', 400);
        }
    }

    // ─── Upload ─────────────────────────────────────────────────────────────────

    static async uploadImage(filepath: string, folder: MediaFolder, uploadedBy?: Types.ObjectId): Promise<IMedia> {
        try {
            const stat = await fs.stat(filepath);
            if (stat.size > MAX_IMAGE_SIZE_BYTES) {
                throw new AppError(`Imagen supera el límite de ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024} MB`, 400);
            }

            // Procesamiento asíncrono controlado con Sharp en memoria
            const webpBuffer = await sharp(filepath).webp({ quality: 82 }).toBuffer();

            // Liberamos el archivo físico original del disco tan pronto como tenemos el buffer en RAM
            await this.cleanupTemp(filepath);

            const result = await new Promise<UploadResult>((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { public_id: uuid(), folder, format: 'webp', resource_type: 'image' },
                    (error, res) => {
                        if (error || !res) return reject(error ?? new Error('Cloudinary no devolvió resultado'));
                        resolve({
                            publicId: res.public_id,
                            secureUrl: res.secure_url,
                            format: res.format,
                            bytes: res.bytes,
                            width: res.width,
                            height: res.height,
                            resourceType: 'image',
                        });
                    }
                );
                stream.end(webpBuffer);
            });

            return await Media.create({ ...result, folder, uploadedBy });
        } catch (error) {
            // Bloque de contingencia si falla antes de Sharp o durante la subida por stream
            await this.cleanupTemp(filepath);
            throw error;
        }
    }

    static async uploadVideo(filepath: string, folder: MediaFolder, uploadedBy?: Types.ObjectId): Promise<IMedia> {
        try {
            const stat = await fs.stat(filepath);
            if (stat.size > MAX_VIDEO_SIZE_BYTES) {
                throw new AppError(`Video supera el límite de ${MAX_VIDEO_SIZE_BYTES / 1024 / 1024} MB`, 400);
            }

            const cloudRes = await cloudinary.uploader.upload(filepath, {
                public_id: uuid(),
                folder,
                resource_type: 'video',
            });

            return await Media.create({
                publicId: cloudRes.public_id,
                secureUrl: cloudRes.secure_url,
                folder,
                resourceType: 'video',
                format: cloudRes.format,
                bytes: cloudRes.bytes,
                width: cloudRes.width,
                height: cloudRes.height,
                duration: cloudRes.duration,
                uploadedBy,
            });
        } finally {      // Aseguramos limpieza del archivo temporal en cualquier caso
            await this.cleanupTemp(filepath);
        }
    }

    // ─── Delete ──────────────────────────────────────────────────────────────────

    static async deleteByPublicId(publicId: string, resourceType: ResourceType = 'image'): Promise<void> {
        await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
        await Media.deleteOne({ publicId });
    }

    static async deleteById(id: string): Promise<void> {
        const media = await Media.findById(id);
        if (!media) throw new AppError('Recurso no encontrado en la base de datos', 404);

        await this.deleteByPublicId(media.publicId, media.resourceType);
    }

    static async deleteByUrl(url: string): Promise<void> {
        this.assertCloudinaryUrl(url);
        const media = await Media.findOne({ secureUrl: url });
        if (!media) throw new AppError('Recurso no encontrado en la base de datos', 404);
        await this.deleteByPublicId(media.publicId, media.resourceType);
    }

    // ─── Query ───────────────────────────────────────────────────────────────────

    static async listByFolder(folder: MediaFolder, page = 1, limit = 20): Promise<{ data: IMedia[]; total: number; pages: number }> {
        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            Media.find({ folder }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            Media.countDocuments({ folder }),
        ]);
        return { data, total, pages: Math.ceil(total / limit) };
    }

    static async getById(id: string): Promise<IMedia> {
        const media = await Media.findById(id).lean();
        if (!media) throw new AppError('Recurso no encontrado', 404);
        return media as unknown as IMedia;
    }
}