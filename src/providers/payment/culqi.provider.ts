// File: backend/src/providers/payment/culqi.provider.ts
// ✅ VERSIÓN MEJORADA - DETECCIÓN DE 3DS MÁS ROBUSTA

import { AppError } from '../../utils/AppError';
import {
    IPaymentProvider,
    ICreateOrderPayload,
    ICreateChargePayload
} from './payment.provider.interface';

interface CulqiResponse {
    id?: string;
    object?: string;
    user_message?: string;
    merchant_message?: string;
    action_code?: string;
    state?: string;
    [key: string]: any;
}

interface CulqiErrorResponse {
    merchant_message?: string;
    user_message?: string;
    action_code?: string;
    code?: string;
    object?: string;
}

export class CulqiProvider implements IPaymentProvider {
    private readonly secretKey: string;
    private readonly baseURL = 'https://api.culqi.com/v2';

    constructor() {
        this.secretKey = process.env.CULQI_SECRET_KEY || process.env.CULQI_API_KEY || '';
        
        if (!this.secretKey) {
            throw new Error('[CulqiProvider] CRÍTICO: CULQI_SECRET_KEY no definida en .env');
        }
    }

    private get headers(): Record<string, string> {
        return {
            'Authorization': `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json'
        };
    }

    private validateOrderPayload(payload: ICreateOrderPayload): void {
        if (!Number.isInteger(payload.amount) || payload.amount < 100) {
            throw new AppError(`Monto inválido: ${payload.amount}. Debe ser un número entero >= 100 céntimos`, 400);
        }

        if (!['PEN', 'USD'].includes(payload.currency_code)) {
            throw new AppError(`Moneda no soportada: ${payload.currency_code}. Usar: PEN | USD`, 400);
        }

        if (!payload.description || payload.description.length > 80) {
            throw new AppError(`Descripción inválida. Max 80 caracteres. Recibido: ${payload.description?.length || 0}`, 400);
        }

        if (!payload.order_number || payload.order_number.length > 80) {
            throw new AppError(`Número de orden inválido. Max 80 caracteres. Recibido: ${payload.order_number?.length || 0}`, 400);
        }

        const { first_name, last_name, email, phone_number } = payload.client_details;

        if (!first_name || first_name.length > 50) {
            throw new AppError(`Nombre inválido. Max 50 caracteres. Recibido: ${first_name?.length || 0}`, 400);
        }

        if (!last_name || last_name.length > 50) {
            throw new AppError(`Apellido inválido. Max 50 caracteres. Recibido: ${last_name?.length || 0}`, 400);
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
            throw new AppError(`Email inválido: ${email}`, 400);
        }

        const phoneRegex = /^\d{9,15}$/;
        if (!phone_number || !phoneRegex.test(phone_number)) {
            throw new AppError(`Teléfono inválido: ${phone_number}. Formato PE: 9 dígitos sin espacios`, 400);
        }

        if (payload.expiration_date) {
            if (!Number.isInteger(payload.expiration_date) || payload.expiration_date <= Math.floor(Date.now() / 1000)) {
                throw new AppError(`Fecha de expiración inválida. Debe ser timestamp UNIX futuro (segundos)`, 400);
            }
        }
    }

    private validateChargePayload(payload: ICreateChargePayload): void {
        if (!Number.isInteger(payload.amount) || payload.amount < 100) {
            throw new AppError(`Monto inválido: ${payload.amount}. Debe ser un número entero >= 100 céntimos`, 400);
        }

        if (!['PEN', 'USD'].includes(payload.currency_code)) {
            throw new AppError(`Moneda no soportada: ${payload.currency_code}. Usar: PEN | USD`, 400);
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(payload.email)) {
            throw new AppError(`Email inválido: ${payload.email}`, 400);
        }

        if (!payload.source_id || typeof payload.source_id !== 'string') {
            throw new AppError(`source_id (token) inválido o faltante`, 400);
        }

        const {
  first_name,
  last_name,
  phone_number,
  address,
  address_city,
  country_code,
  device_finger_print_id
} = payload.antifraude_details;

        if (
  !first_name ||
  !last_name ||
  !phone_number ||
  !address ||
  !address_city ||
  !country_code ||
  !device_finger_print_id
) {
  throw new AppError(
    'Datos de antifraude incompletos',
    400
  );
}

        if (country_code !== 'PE') {
            throw new AppError(`country_code debe ser 'PE' para órdenes en Perú`, 400);
        }
    }

    private extractErrorMessage(data: CulqiErrorResponse, statusCode: number): string {
        if (data.user_message) return data.user_message;
        if (data.merchant_message) return data.merchant_message;
        if (data.code) return `Error Culqi [${data.code}]: ${data.object || 'Desconocido'}`;
        return `Error HTTP ${statusCode} de Culqi`;
    }

    // ========================================================================
    // ✅ DETECTAR 3DS - FUNCIÓN MEJORADA
    // ========================================================================
    private is3DSRequired(
        response: any,
        statusCode: number
    ): boolean {
        // Culqi retorna HTTP 200 con action_code = 'REVIEW' o 'CHALLENGE' cuando se necesita 3DS
        const actionCode = response?.action_code?.toUpperCase?.();
        
        console.log('[CulqiProvider] 🔍 Verificando 3DS:', {
            statusCode,
            actionCode,
            userMessage: response?.user_message?.substring(0, 50),
            merchantMessage: response?.merchant_message?.substring(0, 50)
        });

        // ✅ CONDICIONES PARA DETECTAR 3DS:
        const conditions = [
            // 1. action_code es CHALLENGE o REVIEW
            statusCode === 200 && (actionCode === 'CHALLENGE' || actionCode === 'REVIEW'),
            
            // 2. El mensaje contiene "3DS" o "autenticación"
            statusCode === 200 && 
            (response?.user_message?.toLowerCase().includes('3ds') ||
             response?.merchant_message?.toLowerCase().includes('3ds') ||
             response?.user_message?.toLowerCase().includes('autenticaci')),
            
            // 3. El campo de estado dice "pending_3ds" o similar
            response?.state?.toLowerCase().includes('3ds') ||
            response?.state?.toLowerCase() === 'pending_challenge',
            
            // 4. Object type es "challenge"
            response?.object?.toLowerCase() === 'challenge'
        ];

        const result = conditions.some(c => c);
        
        if (result) {
            console.log('[CulqiProvider] 🔐 3DS DETECTADO:', {
                reason: conditions
                    .map((c, i) => c ? `Condición ${i + 1}` : null)
                    .filter(Boolean)
                    .join(', ')
            });
        }

        return result;
    }

    async createOrder(payload: ICreateOrderPayload): Promise<{ id: string; [key: string]: any }> {
        try {
            this.validateOrderPayload(payload);

            const sanitizedPayload = {
                ...payload,
                client_details: {
                    first_name: payload.client_details.first_name.trim(),
                    last_name: payload.client_details.last_name.trim(),
                    email: payload.client_details.email.trim().toLowerCase(),
                    phone_number: payload.client_details.phone_number.trim()
                },
                description: payload.description.trim(),
                order_number: payload.order_number.trim(),
                confirm: payload.confirm ?? false
            };

            console.log('[CulqiProvider] 📦 Creando orden...', {
                order_number: sanitizedPayload.order_number,
                amount: sanitizedPayload.amount,
                currency: sanitizedPayload.currency_code,
                email: sanitizedPayload.client_details.email
            });

            const response = await fetch(`${this.baseURL}/orders`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(sanitizedPayload)
            });

            const data = (await response.json()) as CulqiResponse;

            if (!response.ok) {
                const errorMsg = this.extractErrorMessage(data as CulqiErrorResponse, response.status);
                console.error('[CulqiProvider] ❌ Error al crear orden:', {
                    status: response.status,
                    message: errorMsg,
                    culqiResponse: data
                });
                throw new AppError(errorMsg, response.status);
            }

            if (!data.id) {
                console.error('[CulqiProvider] ❌ Respuesta sin ID:', data);
                throw new AppError('Respuesta inválida de Culqi: falta el identificador de orden', 502);
            }

            console.log('[CulqiProvider] ✅ Orden creada exitosamente:', data.id);
            return data as { id: string; [key: string]: any };

        } catch (error: any) {
            if (error instanceof AppError) throw error;
            
            console.error('[CulqiProvider] ❌ Error inesperado en createOrder:', error);
            throw new AppError(
                error.message || 'Error de conexión con Culqi. Intenta más tarde.',
                502
            );
        }
    }

   async createCharge(payload: ICreateChargePayload): Promise<{ id: string; [key: string]: any }> {
    try {
        this.validateChargePayload(payload);

        // Construir el payload explícitamente sin usar spread operator en la raíz 
        // para evitar enviar `antifraude_details` a Culqi.
        const sanitizedPayload: any = {
            amount: payload.amount,
            currency_code: payload.currency_code,
            email: payload.email.trim().toLowerCase(),
            source_id: payload.source_id,
            antifraud_details: { // Culqi exige 'antifraud_details' sin 'e'
                first_name: payload.antifraude_details.first_name.trim(),
                last_name: payload.antifraude_details.last_name.trim(),
                phone_number: payload.antifraude_details.phone_number.trim(),
                address: payload.antifraude_details.address.trim(),
                address_city: payload.antifraude_details.address_city.trim(),
                country_code: payload.antifraude_details.country_code,
                device_finger_print_id: payload.antifraude_details.device_finger_print_id
            }
        };

        if (payload.authentication_3DS) {
            sanitizedPayload.authentication_3DS = {
                xid: (payload.authentication_3DS as any).xid,
                cavv: (payload.authentication_3DS as any).cavv,
                eci: (payload.authentication_3DS as any).eci,
                protocolVersion: (payload.authentication_3DS as any).protocolVersion,
                directoryServerTransactionId: (payload.authentication_3DS as any).directoryServerTransactionId
            };
        }

            console.log('[CulqiProvider] 💳 Procesando cargo...', {
                amount: sanitizedPayload.amount,
                currency: sanitizedPayload.currency_code,
                email: sanitizedPayload.email,
                has3DS: !!sanitizedPayload.authentication_3DS
            });

            const response = await fetch(`${this.baseURL}/charges`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(sanitizedPayload)
            });

            const data = (await response.json()) as CulqiResponse;

            console.log('[CulqiProvider] 📊 Respuesta de Culqi:', {
                statusCode: response.status,
                actionCode: data.action_code,
                state: data.state,
                userMessage: data.user_message?.substring(0, 50),
                hasId: !!data.id
            });

            // ✅ DETECTAR SI 3DS ES REQUERIDO (mejorado)
            if (this.is3DSRequired(data, response.status)) {
                console.log('[CulqiProvider] 🔐 3DS Requerido detectado');
                const error: any = new Error('Culqi 3DS Authentication Required');
                error.is3DS = true;
                error.culqiStatus = 200;
                error.needs3DS = true;
                error.status = 200;
                throw error;
            }

            if (!response.ok) {
                const errorMsg = this.extractErrorMessage(data as CulqiErrorResponse, response.status);
                console.error('[CulqiProvider] ❌ Error al procesar cargo:', {
                    status: response.status,
                    message: errorMsg,
                    culqiResponse: data
                });
                throw new AppError(errorMsg, response.status);
            }

            if (!data.id) {
                console.error('[CulqiProvider] ❌ Respuesta sin ID:', data);
                throw new AppError('Respuesta inválida de Culqi: falta el identificador del cargo', 502);
            }

            console.log('[CulqiProvider] ✅ Cargo procesado exitosamente:', data.id);
            return data as { id: string; [key: string]: any };

        } catch (error: any) {
            if (error.is3DS === true || error instanceof AppError) {
                throw error;
            }
            
            console.error('[CulqiProvider] ❌ Error inesperado en createCharge:', error);
            throw new AppError(
                error.message || 'Error al procesar el pago. Intenta más tarde.',
                502
            );
        }
    }
}