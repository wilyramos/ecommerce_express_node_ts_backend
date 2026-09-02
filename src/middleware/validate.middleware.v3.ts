// backend/src/middleware/validate.middleware.v3.ts
import { Request, Response, NextFunction } from 'express';
import { ZodType, ZodError } from 'zod';
import { AppError } from '../utils/AppError';

export const validateRequest = (schema: ZodType<any, any, any>) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const validatedData = await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });

            req.body = validatedData.body;
            
            // Express define 'query' y 'params' usando getters. La asignación directa (req.query = ...) 
            // lanza un TypeError. Se debe usar Object.defineProperty para sobrescribirlos de forma segura.
            Object.defineProperty(req, 'query', { 
                value: validatedData.query, 
                writable: true, 
                configurable: true 
            });
            
            Object.defineProperty(req, 'params', { 
                value: validatedData.params, 
                writable: true, 
                configurable: true 
            });

            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const formattedErrors = error.issues.map((issue) => ({
                    field: issue.path.join('.'),
                    message: issue.message,
                }));

                const mainField = formattedErrors[0]?.field;
                const mainMessage = formattedErrors[0]?.message || 'Error de validación';
                const fieldPrefix = mainField ? `[${mainField}] ` : '';

                next(new AppError(`Validación fallida: ${fieldPrefix}${mainMessage}`, 400));
                return;
            }
            next(error);
        }
    };
};