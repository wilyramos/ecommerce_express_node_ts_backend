import { Request, Response } from 'express';
import { catchAsync } from '../../utils/catchAsync';
import { ApiResponse } from '../../utils/ApiResponse';
import { checkoutService } from './checkout.service';

export const checkoutController = {
    processPaymentCulqi: catchAsync(async (req: Request, res: Response) => {
        const result = await checkoutService.processCulqiPayment(req.body);

        // Si la orden ya estaba pagada, devolvemos un 200 normal informando del estado
        if (result.alreadyProcessed) {
            return ApiResponse.success(res, 200, result.message);
        }

        // Respuesta exitosa estándar
        return ApiResponse.success(
            res,
            200,
            result.message,
            result.data
        );
    })
};