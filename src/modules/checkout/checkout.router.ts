import { Router } from 'express';
import { checkoutController } from './checkout.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { Request, Response, NextFunction } from 'express';

const router = Router();

// Middleware para permitir invitados o usuarios logueados
const optionalAuthenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.headers.authorization?.startsWith('Bearer ')) {
        return next();
    }
    try {
        await authenticate(req, res, () => next());
    } catch {
        (req as any).user = undefined;
        next();
    }
};

// Ruta: POST /api/checkout/v3/process-payment-culqi
router.post(
    '/process-payment-culqi',
    optionalAuthenticate,
    checkoutController.processPaymentCulqi
);

export default router;