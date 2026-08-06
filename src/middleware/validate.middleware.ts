// backend/src/middleware/validate.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { ApiResponse } from '../utils/ApiResponse';

export const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        const formattedErrors = errors.array().map((err) => {
            if (err.type === 'field') {
                return {
                    field: err.path,
                    message: err.msg,
                };
            }
            return { message: err.msg };
        });

        ApiResponse.error(
            res,
            400,
            'Error de validación en los datos enviados',
            formattedErrors
        );
        return;
    }

    next();
};