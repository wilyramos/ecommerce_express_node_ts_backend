// backend/src/middleware/validate.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { ZodType, ZodError } from 'zod';
import { AppError } from '../utils/AppError';

export const validateRequest = (schema: ZodType<any, any, any>) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const formattedErrors = error.issues.map(issue => ({
                    field: issue.path.join('.'),
                    message: issue.message,
                }));

                const mainMessage = formattedErrors[0]?.message || 'Error de validación';
                next(new AppError(`Validación fallida: ${mainMessage}`, 400));
                return;
            }
            next(error);
        }
    };
};