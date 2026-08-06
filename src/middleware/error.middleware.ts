// backend/src/middleware/error.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';

export const globalErrorHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Error interno del servidor';
    let details: any = null;

    // 1. Manejo de AppError (Errores operativos controlados)
    if (err instanceof AppError) {
        statusCode = err.statusCode;
        message = err.message;
    }

    // 2. Errores específicos de MongoDB / Mongoose
    else if (err.name === 'MongoServerError' || err.name === 'MongoError') {
        // Clave duplicada (E11000)
        if (err.code === 11000) {
            statusCode = 400;
            const duplicateField = Object.keys(err.keyValue || {})[0] || 'campo';
            const duplicateValue = err.keyValue ? err.keyValue[duplicateField] : '';
            message = `El valor '${duplicateValue}' para el campo '${duplicateField}' ya está en uso.`;
            details = { field: duplicateField, value: duplicateValue };
        }
    }

    // 3. Errores de Validación de Mongoose (Schema validation)
    else if (err.name === 'ValidationError') {
        statusCode = 400;
        message = 'Error de validación en la base de datos';
        details = Object.values(err.errors).map((e: any) => ({
            field: e.path,
            message: e.message,
        }));
    }

    // 4. Errores de ID inválido en Mongoose (CastError)
    else if (err.name === 'CastError') {
        statusCode = 400;
        message = `Recurso no encontrado. Formato inválido para el campo '${err.path}'`;
        details = { field: err.path, value: err.value };
    }

    // 5. Errores de Autenticación / Tokens (JWT)
    else if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Token no válido. Por favor inicia sesión de nuevo.';
    } else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Tu sesión ha expirado. Por favor inicia sesión nuevamente.';
    }

    // Ocultar detalles del sistema en producción si es un error no controlado (500)
    if (statusCode === 500 && process.env.NODE_ENV === 'production') {
        message = 'Ocurrió un error inesperado en el servidor.';
        details = null;
    } else if (statusCode === 500 && process.env.NODE_ENV !== 'production') {
        // En desarrollo, adjuntamos el stack trace para debugging
        details = {
            error: err.message,
            stack: err.stack,
        };
    }

    // Registro de logs para errores 500
    if (statusCode === 500) {
        console.error('💥 ERROR NO CONTROLADO:', err);
    }

    ApiResponse.error(res, statusCode, message, details);
};