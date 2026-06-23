import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import { AppError } from '../utils/AppError';

declare global {
    namespace Express {
        interface Request {
            user?: IUser;
        }
    }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const bearer = req.headers.authorization;
    if (!bearer || !bearer.startsWith('Bearer ')) {
        return next(new AppError('No autorizado: Token no provisto o formato inválido.', 401));
    }

    const token = bearer.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string);

        if (typeof decoded === 'object' && decoded.id) {
            const user = await User.findById(decoded.id).select('-password').lean();
            if (!user) {
                return next(new AppError('No autorizado: El usuario ya no existe.', 401));
            }
            req.user = user as IUser;
            return next();
        }

        return next(new AppError('No autorizado: Token inválido.', 401));
    } catch (error) {
        return next(new AppError('No autorizado: Sesión expirada o token corrupto.', 401));
    }
};

export const restrictToRoles = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user || !roles.includes(req.user.rol)) {
            return next(new AppError('Acceso denegado: Permisos insuficientes para realizar esta acción.', 403));
        }
        next();
    };
};

// Helpers limpios usando la función genérica
export const isAdmin = restrictToRoles('administrador');
export const isVendedor = restrictToRoles('vendedor');
export const isAdminOrVendedor = restrictToRoles('administrador', 'vendedor');