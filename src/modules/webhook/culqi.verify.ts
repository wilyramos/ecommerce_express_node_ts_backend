const CULQI_API_BASE = 'https://api.culqi.com/v2';

export interface CulqiChargeVerification {
    valid: boolean;
    outcomeType?: string;
    orderNumber?: string;
}

export interface CulqiOrderVerification {
    valid: boolean;
    state?: string;
    orderNumber?: string;
}

interface CulqiChargeResponse {
    outcome?: {
        type?: string;
    };
    response_code?: string;
    order_number?: string;
    metadata?: {
        orderNumber?: string;
        order_number?: string;
        [key: string]: unknown;
    };
}

interface CulqiOrderResponse {
    state?: string;
    order_number?: string;
    metadata?: {
        orderNumber?: string;
        order_number?: string;
        [key: string]: unknown;
    };
}

export async function validateCulqiCharge(chargeId: string): Promise<CulqiChargeVerification> {
    try {
        const response = await fetch(`${CULQI_API_BASE}/charges/${chargeId}`, {
            headers: {
                Authorization: `Bearer ${process.env.CULQI_API_KEY}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            console.warn(`⚠️ [Culqi Verify] Cargo ${chargeId} no encontrado en API (${response.status})`);
            return { valid: false };
        }

        const charge = (await response.json()) as CulqiChargeResponse;

        // Búsqueda flexible del identificador comercial: campo nativo o metadata
        const orderNumber =
            charge.order_number ||
            charge.metadata?.orderNumber ||
            charge.metadata?.order_number ||
            '';

        return {
            valid: true,
            outcomeType: charge.outcome?.type ?? charge.response_code ?? '',
            orderNumber: String(orderNumber).trim(),
        };
    } catch (error) {
        console.error('❌ [Culqi Verify] Error verificando cargo:', error);
        return { valid: false };
    }
}

export async function validateCulqiOrder(culqiOrderId: string): Promise<CulqiOrderVerification> {
    try {
        const response = await fetch(`${CULQI_API_BASE}/orders/${culqiOrderId}`, {
            headers: {
                Authorization: `Bearer ${process.env.CULQI_API_KEY}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            console.warn(`⚠️ [Culqi Verify] Orden ${culqiOrderId} no encontrada en API (${response.status})`);
            return { valid: false };
        }

        const order = (await response.json()) as CulqiOrderResponse;

        const orderNumber =
            order.order_number ||
            order.metadata?.orderNumber ||
            order.metadata?.order_number ||
            '';

        return {
            valid: true,
            state: order.state ?? '',
            orderNumber: String(orderNumber).trim(),
        };
    } catch (error) {
        console.error('❌ [Culqi Verify] Error verificando orden:', error);
        return { valid: false };
    }
}