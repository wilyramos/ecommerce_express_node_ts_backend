// File: backend/src/modules/checkout/checkout.service.ts

import Order, { PaymentStatus } from '../../models/Order';
import { AppError } from '../../utils/AppError';

export interface ProcessCulqiDTO {
    token?: string;
    order?: string;
    amount: number;
    currency_code?: string;
    email: string;
    orderNumber: string;
    authentication_3DS?: any;
}

export const checkoutService = {
    async processCulqiPayment(dto: ProcessCulqiDTO) {
        const { token, order: culqiOrderId, amount, currency_code = 'PEN', email, orderNumber, authentication_3DS } = dto;

        if (!token && !culqiOrderId) throw new AppError("Payload inválido", 400);
        if (!amount || !email || !orderNumber) throw new AppError("Faltan parámetros requeridos", 400);

        const culqiPrivateKey = process.env.CULQI_API_KEY;
        if (!culqiPrivateKey) throw new AppError("CULQI_API_KEY no definida", 500);

        const existingOrder = await Order.findOne({ orderNumber });
        if (!existingOrder) throw new AppError("Orden no encontrada", 404);

        if (existingOrder.payment?.status === PaymentStatus.APPROVED) {
            return { alreadyProcessed: true, message: "La orden ya ha sido pagada." };
        }

        if (token) {
            const payload: any = {
                amount,
                currency_code,
                email,
                source_id: token,
                capture: true,
                order: existingOrder.culqiOrderId, 
                antifraud_details: {
                    address: existingOrder.shippingAddress?.direccion || "No especificada",
                    address_city: existingOrder.shippingAddress?.provincia || "No especificada",
                    country_code: "PE",
                    first_name: existingOrder.customerProfile.nombre,
                    last_name: existingOrder.customerProfile.apellidos,
                    phone_number: existingOrder.customerProfile.telefono,
                },
                metadata: { orderNumber },
            };

            if (authentication_3DS) {
                payload.authentication_3DS = authentication_3DS;
            }

            const culqiResponse = await fetch("https://api.culqi.com/v2/charges", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${culqiPrivateKey}` },
                body: JSON.stringify(payload)
            });

            const data = await culqiResponse.json() as any;

            const is3DSReview = data.action_code === "REVIEW" || data.type === "review" || data.outcome?.action_code === "REVIEW";
            
            if (is3DSReview) {
                return {
                    alreadyProcessed: false,
                    message: "Reto 3DS requerido por el banco",
                    data: {
                        action_code: "REVIEW",
                        id: token 
                    }
                };
            }

            if (!culqiResponse.ok) {
                throw new AppError(data.user_message ?? "Error al procesar el pago", culqiResponse.status);
            }

            return { alreadyProcessed: false, message: "Transacción enviada correctamente.", data };
        }

        if (culqiOrderId) {
            existingOrder.payment = { provider: 'culqi', method: 'multipago', transactionId: culqiOrderId, status: PaymentStatus.PENDING };
            await existingOrder.save();
            return { alreadyProcessed: false, message: "Orden registrada. Esperando webhook.", data: { transactionId: culqiOrderId } };
        }

        throw new AppError("Payload inválido", 400);
    }
};