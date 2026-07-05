// File: backend/src/modules/devoluciones/devoluciones.model.ts

//TODO: Agregar validaciones de stock y precio histórico al crear una devolución.

import mongoose, { Schema, Document, Types } from 'mongoose';

export enum ReturnType {
    DESISTIMIENTO = 'desistimiento', // Cliente se arrepintió (producto intacto)
    FALLA_FABRICA = 'falla_fabrica'  // Defecto técnico (va a merma/proveedor)
}

export enum ReturnStatus {
    PENDING = 'pending',
    RECEIVED = 'received',   // Producto llegó a oficina para evaluación
    APPROVED = 'approved',   // Aceptado, ejecuta stock/dinero
    REJECTED = 'rejected'    // Denegado (ej: producto manipulado/roto)
}

export enum ReturnItemCondition {
    PERFECT = 'perfect',     // Regresa al stock comercial dinámico
    DEFECTIVE = 'defective'  // Va a stock de merma (no se vuelve a vender)
}

export interface IReturnItem {
    productId: Types.ObjectId;
    variantId?: Types.ObjectId;
    quantity: number;
    price: number; // Precio histórico al que se le vendió
    itemCondition: ReturnItemCondition;
}

export interface IReturnClaim extends Document {
    returnNumber: string;    // Ej: RET-000001
    orderId: Types.ObjectId; // Referencia a la orden original entregada
    type: ReturnType;
    status: ReturnStatus;
    items: IReturnItem[];
    refundAmount: number;    // Monto total a devolver o acreditar
    reason: string;          // Explicación del cliente o admin
    actionBy: Types.ObjectId | string; // Admin que aprueba/rechaza
    createdAt: Date;
    updatedAt: Date;
}

const returnItemSchema = new Schema<IReturnItem>({
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    itemCondition: { type: String, enum: Object.values(ReturnItemCondition), required: true }
}, { _id: false });

const returnClaimSchema = new Schema<IReturnClaim>({
    returnNumber: { type: String, unique: true, required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    type: { type: String, enum: Object.values(ReturnType), required: true },
    status: { type: String, enum: Object.values(ReturnStatus), default: ReturnStatus.PENDING },
    items: { type: [returnItemSchema], required: true },
    refundAmount: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true, trim: true },
    actionBy: { type: Schema.Types.Mixed }
}, { timestamps: true });

export default mongoose.model<IReturnClaim>('ReturnClaim', returnClaimSchema);