// File: backend/src/modules/order/helpers/orderNumber.helper.ts

import crypto from 'crypto';

/**
 * Genera un número de orden comercial blindado contra ataques de enumeración y fuerza bruta.
 * Formato resultante: ORD-YYYYMMDD-XXXXXXXX (Ej: ORD-20260602-A7B39E2F)
 */
export function generateSecureOrderNumber(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    
    // Genera 4 bytes aleatorios criptográficamente seguros y los transforma a hexadecimal (8 caracteres)
    const secureSuffix = crypto.randomBytes(4).toString('hex').toUpperCase();
    
    return `ORD-${date}-${secureSuffix}`;
}