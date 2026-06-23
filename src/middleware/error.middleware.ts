import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';

export const globalErrorHandler = (
    error: unknown,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    // Si el error es una instancia controlada de nuestra aplicación
    if (error instanceof AppError) {
        ApiResponse.error(res, error.statusCode, error.message);
        return;
    }

    // Si es un error nativo de base de datos o de Javascript no controlado
    const errorMessage = error instanceof Error ? error.message : 'Error interno del servidor';

    // Loguear solo en entorno de desarrollo/producción adecuadamente
    console.error(`[ERROR CRÍTICO]: ${errorMessage}`, error);

    ApiResponse.error(
        res,
        500,
        'Ocurrió un error inesperado en el servidor.',
        process.env.NODE_ENV === 'development' ? { error: errorMessage } : undefined
    );
};