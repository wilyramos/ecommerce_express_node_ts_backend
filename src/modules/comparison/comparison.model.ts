// backend/src/modules/comparison/comparison.model.ts

import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IComparisonSpec {
    key: string;
    values: string[];
    scores: number[];
    isKeyDifference: boolean;
}

export interface IFAQItem {
    pregunta: string;
    respuesta: string;
}

export interface IComparison extends Document {
    slug: string;
    title: string;
    metaDescription?: string;
    products: Types.ObjectId[];
    veredictoRapido: string;
    especificaciones: IComparisonSpec[];
    faqItems: IFAQItem[];
    isActive: boolean;
    isFeatured: boolean;
    viewCount: number;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

// ── Sub-schemas ───────────────────────────────────────────

const specSchema = new Schema<IComparisonSpec>(
    {
        key: {
            type: String,
            required: true,
            trim: true,
        },
        values: {
            type: [String],
            required: true,
            default: [],
        },
        scores: {
            type: [Number],
            required: true,
            default: [],
        },
        isKeyDifference: {
            type: Boolean,
            default: false,
        },
    },
    { _id: false }
);

const faqSchema = new Schema<IFAQItem>(
    {
        pregunta: {
            type: String,
            required: true,
            trim: true,
        },
        respuesta: {
            type: String,
            required: true,
            trim: true,
        },
    },
    { _id: false }
);

// ── Schema principal ──────────────────────────────────────

const comparisonSchema = new Schema<IComparison>(
    {
        slug: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        metaDescription: {
            type: String,
            trim: true,
            default: undefined,
        },
        products: {
            type: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
            required: true,
            default: [],
        },
        veredictoRapido: {
            type: String,
            required: true,
            trim: true,
        },
        especificaciones: {
            type: [specSchema],
            default: [],
        },
        faqItems: {
            type: [faqSchema],
            default: [],
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        isFeatured: {
            type: Boolean,
            default: false,
        },
        viewCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        deletedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

// ── Índices ───────────────────────────────────────────────

comparisonSchema.index(
    { slug: 1 },
    { unique: true, partialFilterExpression: { deletedAt: null } }
);
comparisonSchema.index({ deletedAt: 1, isActive: 1, isFeatured: -1, createdAt: -1 });
comparisonSchema.index({ products: 1, deletedAt: 1 });

export default mongoose.model<IComparison>('Comparison', comparisonSchema);