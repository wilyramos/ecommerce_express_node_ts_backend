// File: backend/src/modules/discount/discount.model.ts
import mongoose, { Schema, Document, Types } from 'mongoose';

export enum DiscountType {
    PERCENTAGE = 'PERCENTAGE',
    FIXED_AMOUNT = 'FIXED_AMOUNT'
}

export enum DiscountTarget {
    ALL_PRODUCTS = 'ALL_PRODUCTS',
    SPECIFIC_PRODUCTS = 'SPECIFIC_PRODUCTS'
}

export interface IDiscount extends Document {
    code: string;
    description: string;
    type: DiscountType;
    value: number; // Porcentaje (ej. 15) o Monto exacto (ej. 50.00)
    target: DiscountTarget;
    applicableProducts: Types.ObjectId[]; // Si aplica solo a ciertos productos
    
    // Reglas de Negocio
    minPurchaseAmount: number;
    usageLimitTotal: number | null; // Usos totales en la tienda (null = ilimitado)
    currentUsageCount: number;
    
    // Control por Cliente
    usageLimitPerCustomer: number;
    usedBy: { userId: Types.ObjectId | string; count: number }[]; // Rastrea quién lo usó
    
    // Vigencia
    startDate: Date;
    endDate: Date | null;
    isActive: boolean;
}

const discountSchema = new Schema<IDiscount>({
    code: { 
        type: String, 
        required: [true, 'El código es requerido'], 
        unique: true, 
        uppercase: true, 
        trim: true 
    },
    description: { type: String, required: true },
    type: { type: String, enum: Object.values(DiscountType), required: true },
    value: { type: Number, required: true, min: 0 },
    target: { type: String, enum: Object.values(DiscountTarget), default: DiscountTarget.ALL_PRODUCTS },
    applicableProducts: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    
    minPurchaseAmount: { type: Number, default: 0 },
    usageLimitTotal: { type: Number, default: null },
    currentUsageCount: { type: Number, default: 0 },
    
    usageLimitPerCustomer: { type: Number, default: 1 },
    usedBy: [{
        userId: { type: Schema.Types.Mixed, required: true }, // Puede ser Mongo ObjectId o Email de Invitado
        count: { type: Number, default: 1 }
    }],
    
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, default: null },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

discountSchema.index({ code: 1 });
discountSchema.index({ isActive: 1, startDate: 1, endDate: 1 });

export default mongoose.model<IDiscount>('Discount', discountSchema);