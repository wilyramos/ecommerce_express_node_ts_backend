// File: backend/src/modules/webhook/deductStock.ts

import mongoose from 'mongoose';
import Product from '../../models/Product';
import { IOrderItem } from '../../models/Order';

export interface DeductStockResult {
    success: boolean;
    outOfStockItems: string[]; // nombres de ítems sin stock suficiente
}

/**
 * Descuenta el stock de cada ítem de la orden dentro de una transacción activa.
 *
 * Reglas:
 * - Si el producto tiene variantes, descuenta de `variant.stock` y recalcula
 *   `product.stock` como la suma de todos los stocks de variante.
 * - Si el producto no tiene variantes, descuenta directamente de `product.stock`.
 * - En lugar de lanzar un error ante stock insuficiente, devuelve los ítems
 *   problemáticos en `outOfStockItems` para que el caller decida el estado
 *   de la orden (PROCESSING vs PAID_BUT_OUT_OF_STOCK).
 * - Lanza Error solo ante inconsistencias fatales (producto/variante inexistente).
 */
export async function deductStock(
    items: IOrderItem[],
    session: mongoose.ClientSession
): Promise<DeductStockResult> {
    const outOfStockItems: string[] = [];

    for (const item of items) {
        // Soporta tanto ObjectId populado como referencia directa
        const productId = (item.productId as any)?._id ?? item.productId;

        const product = await Product.findById(productId).session(session);

        if (!product) {
            throw new Error(`Producto no encontrado en BD: ${productId}`);
        }

        if (item.variantId) {
            // ── Producto con variante ──────────────────────────────────────────
            const variant = product.variants?.find(
                (v) => v._id?.toString() === item.variantId?.toString()
            );

            if (!variant) {
                throw new Error(
                    `Variante ${item.variantId} no encontrada para el producto "${product.nombre}"`
                );
            }

            if ((variant.stock ?? 0) < item.quantity) {
                outOfStockItems.push(
                    `${product.nombre}${variant.nombre ? ` (${variant.nombre})` : ''}`
                );
                // No desconta — continúa evaluando el resto de ítems
                continue;
            }

            variant.stock -= item.quantity;

            // Stock global = suma de todas las variantes (fuente de verdad)
            product.stock = product.variants!.reduce(
                (sum, v) => sum + (v.stock ?? 0),
                0
            );

        } else {
            // ── Producto sin variantes ─────────────────────────────────────────
            if ((product.stock ?? 0) < item.quantity) {
                outOfStockItems.push(product.nombre);
                continue;
            }

            product.stock = (product.stock ?? 0) - item.quantity;
        }

        await product.save({ session });
    }

    return {
        success: outOfStockItems.length === 0,
        outOfStockItems,
    };
}