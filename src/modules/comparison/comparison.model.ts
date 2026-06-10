// comparison.model.ts

import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IComparisonSpec {
    key: string;
    values: string[];
    scores: number[];
    isKeyDifference?: boolean;
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
    isFeatured?: boolean;
    viewCount?: number;
    createdAt?: Date;
    updatedAt?: Date;
    deletedAt?: Date | null;
}

// ── Sub-schemas ───────────────────────────────────────────

const specSchema = new Schema<IComparisonSpec>(
    {
        key: {
            type: String,
            required: true,
            trim: true
        },
        values: {
            type: [String],
            required: true,
            validate: [
                (v: string[]) => v.length >= 2,
                'Se necesita al menos un valor por producto.'
            ]
        },
        scores: {
            type: [{ type: Number, min: 0, max: 100 }],
            required: true,
            validate: [
                (v: number[]) => v.length >= 2,
                'Se necesita al menos un score por producto.'
            ]
        },
        isKeyDifference: {
            type: Boolean,
            default: false
        }
    },
    { _id: false }
);

const faqSchema = new Schema<IFAQItem>(
    {
        pregunta:  { type: String, required: true, trim: true },
        respuesta: { type: String, required: true, trim: true }
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
            lowercase: true
        },
        title: {
            type: String,
            required: true,
            trim: true,
            minlength: 10,
            maxlength: 100
        },
        metaDescription: {
            type: String,
            trim: true,
            maxlength: 160
        },
        products: {
            type: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
            validate: [
                (v: Types.ObjectId[]) => v.length >= 2,
                'Se requieren al menos 2 productos.'
            ]
        },
        veredictoRapido: {
            type: String,
            required: true,
            trim: true,
            minlength: 20,
            maxlength: 300
        },
        especificaciones: {
            type: [specSchema],
            default: []
        },
        faqItems: {
            type: [faqSchema],
            default: []
        },
        isActive: {
            type: Boolean,
            default: true
        },
        isFeatured: {
            type: Boolean,
            default: false
        },
        viewCount: {
            type: Number,
            default: 0,
            min: 0
        },
        deletedAt: {
            type: Date,
            default: null
        }
    },
    { timestamps: true }
);

// ── Índices ───────────────────────────────────────────────

// Slug único respetando soft delete
comparisonSchema.index(
    { slug: 1 },
    { unique: true, partialFilterExpression: { deletedAt: null } }
);

// Feed principal: activas, destacadas primero, más recientes
comparisonSchema.index({ isActive: 1, isFeatured: -1, createdAt: -1 });

// Mapeo inverso: comparativas que incluyen un producto
comparisonSchema.index({ products: 1 });

// ── Modelo ────────────────────────────────────────────────

export default mongoose.model<IComparison>('Comparison', comparisonSchema);