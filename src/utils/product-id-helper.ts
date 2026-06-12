// File: backend/src/utils/product-id-helper.ts

import { Counter } from '../models/Counter';

/**
 * Genera un ID interno legible para productos.
 * Usa el Counter existente con name: "PRODUCT"
 * Resultado: PRD-000001, PRD-000002, ...
 */
export async function generateProductId(): Promise<string> {
    const counter = await Counter.findOneAndUpdate(
        { name: 'PRODUCT' },
        { $inc: { seq: 1 } },
        { upsert: true, new: true }
    );

    const seq = String(counter.seq).padStart(6, '0');
    return `PRD-${seq}`;
}

/**
 * Genera un ID interno para variantes ligado al producto padre.
 * Resultado: PRD-000001-V01, PRD-000001-V02, ...
 */
export function generateVariantId(productId: string, variantIndex: number): string {
    const idx = String(variantIndex + 1).padStart(2, '0');
    return `${productId}-V${idx}`;
}