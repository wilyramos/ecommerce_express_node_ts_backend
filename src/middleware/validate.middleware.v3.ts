// backend/src/middleware/validate.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { ZodType, ZodError } from 'zod';
import { AppError } from '../utils/AppError';

type ValidationSource = 'body' | 'query' | 'params' | 'all';

export const validateRequest = (
    schema: ZodType<unknown, any, any>,
    source: ValidationSource = 'body'
) => {
    return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
        try {
            if (source === 'all') {
                const parsed = await schema.parseAsync({
                    body: req.body,
                    query: req.query,
                    params: req.params,
                }) as { body?: unknown; query?: unknown; params?: unknown };

                if (parsed.body) req.body = parsed.body;
                if (parsed.query) req.query = parsed.query as any;
                if (parsed.params) req.params = parsed.params as any;
            } else {
                const target = req[source];
                const parsed = await schema.parseAsync(target);
                req[source] = parsed;
            }

            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const formattedErrors = error.issues.map((issue) => ({
                    field: issue.path.join('.'),
                    message: issue.message,
                }));

                const mainMessage = formattedErrors[0]?.message || 'Error de validación';
                const mainField = formattedErrors[0]?.field;
                const fieldPrefix = mainField ? `[${mainField}] ` : '';

                next(new AppError(`Validación fallida: ${fieldPrefix}${mainMessage}`, 400));
                return;
            }
            next(error);
        }
    };
};