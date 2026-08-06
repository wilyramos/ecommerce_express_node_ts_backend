// File: backend/src/modules/discount/discount.model.ts

import mongoose, { Schema, Document, Types } from 'mongoose';

export enum DiscountType {
    PERCENTAGE = 'PERCENTAGE',
    FIXED_AMOUNT = 'FIXED_AMOUNT',
    FREE_SHIPPING = 'FREE_SHIPPING',
    BUY_X_GET_Y = 'BUY_X_GET_Y',
}

export enum DiscountAppliesVia {
    CODE = 'CODE',
    AUTOMATIC = 'AUTOMATIC',
}

export enum DiscountTarget {
    ALL_PRODUCTS = 'ALL_PRODUCTS',
    SPECIFIC_PRODUCTS = 'SPECIFIC_PRODUCTS',
    SPECIFIC_CATEGORIES = 'SPECIFIC_CATEGORIES',
    SPECIFIC_BRANDS = 'SPECIFIC_BRANDS',
    SPECIFIC_COLLECTIONS = 'SPECIFIC_COLLECTIONS',
    SPECIFIC_LINES = 'SPECIFIC_LINES',
}

export interface IBxgyConfig {
    buyQuantity: number;
    getQuantity: number;
    getDiscountType: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE';
    getDiscountValue: number;
    getProducts?: Types.ObjectId[];
    getCategories?: Types.ObjectId[];
}

export interface IUsedByUser {
    userId: Types.ObjectId | string;
    count: number;
}

export interface IDiscount extends Document {
    code?: string;
    title: string;
    description: string;
    appliesVia: DiscountAppliesVia;
    type: DiscountType;
    value: number;
    target: DiscountTarget;

    bxgyConfig?: IBxgyConfig;

    applicableProducts: Types.ObjectId[];
    applicableCategories: Types.ObjectId[];
    applicableBrands: Types.ObjectId[];
    applicableCollections: Types.ObjectId[];
    applicableLines: Types.ObjectId[];

    minPurchaseAmount: number;
    usageLimitTotal: number | null;
    currentUsageCount: number;

    usageLimitPerCustomer: number;
    usedBy: IUsedByUser[];

    startDate: Date;
    endDate: Date | null;
    isActive: boolean;

    createdAt: Date;
    updatedAt: Date;
}

const usedByUserSchema = new Schema<IUsedByUser>(
    {
        userId: { type: Schema.Types.Mixed, required: true },
        count: { type: Number, default: 1, min: 1 },
    },
    { _id: false }
);

const bxgyConfigSchema = new Schema<IBxgyConfig>(
    {
        buyQuantity: { type: Number, required: true, min: 1 },
        getQuantity: { type: Number, required: true, min: 1 },
        getDiscountType: {
            type: String,
            enum: ['PERCENTAGE', 'FIXED_AMOUNT', 'FREE'],
            default: 'FREE',
        },
        getDiscountValue: { type: Number, default: 100, min: 0 },
        getProducts: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
        getCategories: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    },
    { _id: false }
);

const discountSchema = new Schema<IDiscount>(
    {
        code: {
            type: String,
            uppercase: true,
            trim: true,
            default: undefined,
            // Saneamiento clave: convierte strings vacíos a undefined para evitar choque de índice único (sparse)
            set: (v: string) => (v && v.trim() !== '' ? v.toUpperCase().trim() : undefined),
        },
        title: {
            type: String,
            required: [true, 'El título de la promoción es requerido'],
            trim: true,
        },
        description: { type: String, required: true, trim: true },
        appliesVia: {
            type: String,
            enum: Object.values(DiscountAppliesVia),
            default: DiscountAppliesVia.CODE,
        },
        type: {
            type: String,
            enum: Object.values(DiscountType),
            required: true,
        },
        value: { type: Number, default: 0, min: 0 },
        target: {
            type: String,
            enum: Object.values(DiscountTarget),
            default: DiscountTarget.ALL_PRODUCTS,
        },

        bxgyConfig: { type: bxgyConfigSchema, default: null },

        applicableProducts: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
        applicableCategories: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
        applicableBrands: [{ type: Schema.Types.ObjectId, ref: 'Brand' }],
        applicableCollections: [{ type: Schema.Types.ObjectId, ref: 'Collection' }],
        applicableLines: [{ type: Schema.Types.ObjectId, ref: 'ProductLine' }],

        minPurchaseAmount: { type: Number, default: 0, min: 0 },
        usageLimitTotal: { type: Number, default: null },
        currentUsageCount: { type: Number, default: 0, min: 0 },

        usageLimitPerCustomer: { type: Number, default: 1, min: 1 },
        usedBy: [usedByUserSchema],

        startDate: { type: Date, default: Date.now },
        endDate: { type: Date, default: null },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

discountSchema.index({ code: 1 }, { unique: true, sparse: true });
discountSchema.index({ isActive: 1, appliesVia: 1, startDate: 1, endDate: 1 });

export default mongoose.model<IDiscount>('Discount', discountSchema);