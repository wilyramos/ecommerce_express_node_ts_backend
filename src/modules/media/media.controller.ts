import { Request, Response, NextFunction } from 'express';
import formidable, { File } from 'formidable';
import { MediaService } from './media.service';
import { AppError } from '../../utils/AppError';
import { validateFolder, validatePagination } from './media.validator';
import {
  ALLOWED_IMAGE_MIMETYPES,
  ALLOWED_VIDEO_MIMETYPES,
  MAX_FILES_PER_REQUEST,
  MAX_VIDEO_SIZE_BYTES,
} from './media.constants';
import { Types } from 'mongoose';
import fs from 'fs/promises';

const parseForm = (req: Request): Promise<{ fields: formidable.Fields; files: formidable.Files }> => {
  const form = formidable({
    multiples: true,
    maxFileSize: MAX_VIDEO_SIZE_BYTES,
    keepExtensions: true,
  });
  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(new AppError('Error al procesar los archivos: ' + err.message, 400));
      else resolve({ fields, files });
    });
  });
};

export class MediaController {
  static async upload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { fields, files } = await parseForm(req);

      const rawFiles = files.files;
      if (!rawFiles) throw new AppError("No se recibieron archivos en el campo 'files'", 400);

      const filesArray: File[] = Array.isArray(rawFiles) ? rawFiles : [rawFiles];
      if (filesArray.length > MAX_FILES_PER_REQUEST) {
        // Si falla el límite, limpiamos TODOS los archivos que formidable ya bajó a disco
        await Promise.all(filesArray.map(f => fs.unlink(f.filepath).catch(() => {})));
        throw new AppError(`Máximo ${MAX_FILES_PER_REQUEST} archivos por solicitud`, 400);
      }

      const folder = validateFolder(
        Array.isArray(fields.folder) ? fields.folder[0] : fields.folder
      );

      const uploadedBy = (req as any).user?._id as Types.ObjectId | undefined;

      const settled = await Promise.allSettled(
        filesArray.map(async (file) => {
          const mimetype = file.mimetype ?? '';
          
          if (ALLOWED_IMAGE_MIMETYPES.has(mimetype)) {
            return MediaService.uploadImage(file.filepath, folder, uploadedBy);
          }
          if (ALLOWED_VIDEO_MIMETYPES.has(mimetype)) {
            return MediaService.uploadVideo(file.filepath, folder, uploadedBy);
          }

          // Limpieza inmediata en disco del archivo no soportado antes de lanzar el error
          await fs.unlink(file.filepath).catch(() => {});
          throw new AppError(`Tipo de archivo no soportado: ${mimetype || 'desconocido'}`, 415);
        })
      );

      const succeeded = settled
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .map((r) => r.value);

      const failed = settled
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map((r, i) => ({
          index: i,
          filename: filesArray[i]?.originalFilename ?? 'unknown',
          reason: r.reason?.message || 'Error desconocido',
        }));

      const statusCode = succeeded.length === 0 ? 422 : 207;

      res.status(statusCode).json({
        success: succeeded.length > 0,
        uploaded: succeeded.length,
        failed: failed.length,
        data: succeeded,
        errors: failed.length > 0 ? failed : undefined,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      if (!Types.ObjectId.isValid(id)) throw new AppError('ID inválido', 400);
      
      await MediaService.deleteById(id);

      res.status(200).json({ success: true, message: 'Recurso eliminado correctamente' });
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const folder = validateFolder(req.query.folder);
      const { page, limit } = validatePagination(req);
      const result = await MediaService.listByFolder(folder, page, limit);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  static async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      if (!Types.ObjectId.isValid(id)) throw new AppError('ID inválido', 400);
      const media = await MediaService.getById(id);
      res.status(200).json({ success: true, data: media });
    } catch (error) {
      next(error);
    }
  }
}