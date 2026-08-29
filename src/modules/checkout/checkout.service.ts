import Order, { PaymentStatus } from '../../models/Order';
import { AppError } from '../../utils/AppError';

export interface ProcessCulqiDTO {
    token?: string;
    order?: string; // ID de la orden generada por Culqi (ord_live_...)
    amount: number;
    currency_code?: string;
    email: string;
    orderNumber: string;
}

export const checkoutService = {
    async processCulqiPayment(dto: ProcessCulqiDTO) {
        const { token, order: culqiOrderId, amount, currency_code = 'PEN', email, orderNumber } = dto;

        // 1. Validaciones iniciales
        if (!token && !culqiOrderId) {
            throw new AppError("Debe enviar 'token' (para tarjetas/yape) o 'order' (para Cuotéalo/PagoEfectivo)", 400);
        }

        if (!amount || !email || !orderNumber) {
            throw new AppError("Faltan parámetros requeridos (amount, email, orderNumber)", 400);
        }

        const culqiPrivateKey = process.env.CULQI_API_KEY;
        if (!culqiPrivateKey) {
            throw new AppError("Configuración del servidor incompleta (CULQI_API_KEY no definida)", 500);
        }

        // 2. Buscar la orden en la BD por su identificador comercial
        const existingOrder = await Order.findOne({ orderNumber });
        if (!existingOrder) {
            throw new AppError("Orden no encontrada en la base de datos", 404);
        }

        // 3. Idempotencia: Verificar si ya está pagada
        if (existingOrder.payment?.status === PaymentStatus.APPROVED) {
            return {
                alreadyProcessed: true,
                message: "La orden ya ha sido pagada y procesada anteriormente."
            };
        }

        // ── FLUJO 1: Pago asíncrono (Cuotéalo, PagoEfectivo, Billeteras) ──
        if (culqiOrderId) {
            existingOrder.payment = {
                provider: 'culqi',
                method: 'multipago',
                transactionId: culqiOrderId, 
                status: PaymentStatus.PENDING
            };
            await existingOrder.save();

            return {
                alreadyProcessed: false,
                message: "Orden en pasarela registrada localmente. Esperando confirmación del webhook.",
                data: { transactionId: culqiOrderId }
            };
        }

        // ── FLUJO 2: Cargo inmediato síncrono (Tarjetas, Yape Directo) ──
        const payload = {
            amount,
            currency_code,
            email,
            source_id: token,
            capture: true,
            antifraud_details: {
                address: existingOrder.shippingAddress?.direccion || "No especificada",
                address_city: existingOrder.shippingAddress?.provincia || "No especificada",
                country_code: "PE",
                first_name: existingOrder.customerProfile.nombre,
                last_name: existingOrder.customerProfile.apellidos,
                phone_number: existingOrder.customerProfile.telefono,
            },
            metadata: {
                orderNumber: orderNumber, // Vinculación clave para el Webhook
            },
        };

        const culqiResponse = await fetch("https://api.culqi.com/v2/charges", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${culqiPrivateKey}`,
            },
            body: JSON.stringify(payload)
        });

        const data = await culqiResponse.json() as any;

        if (!culqiResponse.ok) {
            throw new AppError(data.user_message ?? "Error al procesar el pago con Culqi", culqiResponse.status);
        }

        // Si es exitoso, el Webhook se encargará de actualizar el estado a APPROVED y descontar stock.
        return {
            alreadyProcessed: false,
            message: "Transacción enviada correctamente. Esperando confirmación del webhook.",
            data
        };
    }
};