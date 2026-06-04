// File: backend/src/modules/webhook/culqi.verify.ts

const CULQI_API_BASE = 'https://api.culqi.com/v2';

export interface CulqiChargeVerification {
    valid: boolean;
    outcomeType?: string;
    orderId?: string;
}

export interface CulqiOrderVerification {
    valid: boolean;
    state?: string;
    orderId?: string;
}

interface CulqiChargeResponse {
    outcome?: {
        type?: string;
    };
    response_code?: string;
    metadata?: {
        order_id?: string;
        [key: string]: unknown;
    };
}

interface CulqiOrderResponse {
    state?: string;
    metadata?: {
        order_id?: string;
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

        return {
            valid: true,
            outcomeType: charge.outcome?.type ?? charge.response_code ?? '',
            orderId: charge.metadata?.order_id ?? '',
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

        return {
            valid: true,
            state: order.state ?? '',
            orderId: order.metadata?.order_id ?? '',
        };
    } catch (error) {
        console.error('❌ [Culqi Verify] Error verificando orden:', error);
        return { valid: false };
    }
}