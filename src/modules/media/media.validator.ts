// File: src/modules/media/media.validator.ts
import { Request, Response, NextFunction } from 'express';
import { ALLOWED_FOLDERS } from './media.constants';
import { MediaFolder } from './media.model';
import { AppError } from '../../utils/AppError';

export const validateFolder = (folder: unknown): MediaFolder => {
  if (!folder || !ALLOWED_FOLDERS.includes(folder as MediaFolder)) {
    throw new AppError(
      `Carpeta inválida. Valores permitidos: ${ALLOWED_FOLDERS.join(', ')}`,
      400
    );
  }
  return folder as MediaFolder;
};

export const validatePagination = (req: Request) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
  return { page, limit };
};