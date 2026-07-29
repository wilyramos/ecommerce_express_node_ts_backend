// File: backend/src/modules/inventory/inventory.model.ts

import mongoose, { Schema, Document, Types } from 'mongoose';

export type InventoryLogType = 'adjustment' | 'sale' | 'return' | 'purchase';

export interface IInventoryLog extends Document {
    productId: Types.ObjectId;
    variantId?: Types.ObjectId;
    type: InventoryLogType;
    quantityChange: number; // Positivo (ingreso/devolución) o Negativo (salida/venta)
    previousStock: number;
    newStock: number;
    reason: string;
    actionBy: string;       // Email o ID de usuario/sistema
    referenceId?: string;   // ID opcional de Orden o Venta de referencia
    createdAt: Date;
}

const inventoryLogSchema = new Schema<IInventoryLog>(
    {
        productId: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: [true, 'El ID del producto es requerido'],
            index: true,
        },
        variantId: {
            type: Schema.Types.ObjectId,
            required: false,
        },
        type: {
            type: String,
            enum: ['adjustment', 'sale', 'return', 'purchase'],
            required: [true, 'El tipo de movimiento es requerido'],
        },
        quantityChange: {
            type: Number,
            required: [true, 'El cambio de cantidad es requerido'],
        },
        previousStock: {
            type: Number,
            required: [true, 'El stock previo es requerido'],
        },
        newStock: {
            type: Number,
            required: [true, 'El nuevo stock es requerido'],
        },
        reason: {
            type: String,
            required: [true, 'El motivo es requerido'],
            trim: true,
        },
        actionBy: {
            type: String,
            required: [true, 'El responsable de la acción es requerido'],
        },
        referenceId: {
            type: String,
            trim: true,
            required: false,
        },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
    }
);

inventoryLogSchema.index({ productId: 1, createdAt: -1 });
inventoryLogSchema.index({ variantId: 1, createdAt: -1 }, { sparse: true });

export const InventoryLog = mongoose.model<IInventoryLog>('InventoryLog', inventoryLogSchema);