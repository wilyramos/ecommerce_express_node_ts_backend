// File: backend/src/modules/webhook/deductStock.ts

import mongoose from 'mongoose';
import Product from '../../models/Product';
import { IOrderItem } from '../../models/Order';

export interface DeductStockResult {
    success: boolean;
    outOfStockItems: string[];
}

/**
 * Descuenta el stock de cada ítem de la orden de forma "Todo o Nada" (Atomic Dry-Run).
 *
 * Reglas:
 * - 1. Primero verifica que TODOS los ítems de la orden tengan stock suficiente.
 * - 2. Si ALGÚN ítem no tiene stock, ABORTA la deducción completa, no modifica nada y 
 *      retorna los ítems faltantes (El Webhook marcará la orden como PAID_BUT_OUT_OF_STOCK).
 * - 3. Si TODOS tienen stock, aplica la deducción al producto/variante y guarda los cambios.
 */
export async function deductStock(
    items: IOrderItem[],
    session: mongoose.ClientSession
): Promise<DeductStockResult> {
    const outOfStockItems: string[] = [];
    const productsToUpdate: Array<{ product: any, isVariant: boolean, variant?: any, quantity: number }> = [];

    // ── FASE 1: Verificación de Stock (Dry-Run) ─────────────────────────────
    for (const item of items) {
        const productId = (item.productId as any)?._id ?? item.productId;
        const product = await Product.findById(productId).session(session);

        if (!product) {
            throw new Error(`Producto no encontrado en BD: ${productId}`);
        }

        if (item.variantId) {
            const variant = product.variants?.find(
                (v) => v._id?.toString() === item.variantId?.toString()
            );

            if (!variant) {
                throw new Error(`Variante ${item.variantId} no encontrada para el producto "${product.nombre}"`);
            }

            if ((variant.stock ?? 0) < item.quantity) {
                outOfStockItems.push(`${product.nombre}${variant.nombre ? ` (${variant.nombre})` : ''}`);
            } else {
                productsToUpdate.push({ product, isVariant: true, variant, quantity: item.quantity });
            }
        } else {
            if ((product.stock ?? 0) < item.quantity) {
                outOfStockItems.push(product.nombre);
            } else {
                productsToUpdate.push({ product, isVariant: false, quantity: item.quantity });
            }
        }
    }

    // ── FASE 2: Decisión Todo o Nada ────────────────────────────────────────
    // Si falta stock de un solo ítem, NO descontamos nada para evitar asimetrías.
    if (outOfStockItems.length > 0) {
        return {
            success: false,
            outOfStockItems,
        };
    }

    // ── FASE 3: Aplicar Deducción ───────────────────────────────────────────
    for (const update of productsToUpdate) {
        if (update.isVariant && update.variant) {
            update.variant.stock -= update.quantity;
            // Stock global = suma de todas las variantes
            update.product.stock = update.product.variants!.reduce(
                (sum: number, v: any) => sum + (v.stock ?? 0),
                0
            );
        } else {
            update.product.stock = (update.product.stock ?? 0) - update.quantity;
        }

        await update.product.save({ session });
    }

    return {
        success: true,
        outOfStockItems: [],
    };
}