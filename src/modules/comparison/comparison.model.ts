//File: backend/src/modules/comparison/comparison.model.ts


import mongoose, { Schema, Document, PopulatedDoc, Types } from 'mongoose';
import { IProduct } from '../../models/Product';

export interface IComparisonSpec {
    key: string;
    values: string[];
    category?: string;
    explanation?: string;     // Explicación de por qué difieren (Valioso para SEO Semántico)
    isKeyDifference?: boolean; // Destaca diferencias críticas visualmente en UI
}

export interface IProductEditorial {
    product: Types.ObjectId | PopulatedDoc<IProduct>;
    resumenIdoneidad: string;
    pros: string[];
    contras: string[];
}

export interface IFAQItem {
    pregunta: string;
    respuesta: string;
    keywords?: string[];
}

export interface IComparison extends Document {
    // ========== SEO & URLs ==========
    slug: string;
    title: string;
    metaTitle?: string;
    metaDescription?: string;

    // ========== Contenido ==========
    products: (Types.ObjectId | PopulatedDoc<IProduct>)[];
    introduccion?: string;
    veredictoRapido?: string;
    conclusion?: string;

    // ========== Datos comparativos ==========
    especificaciones: IComparisonSpec[];
    analisisEditorial: IProductEditorial[];

    // ========== SEO avanzado ==========
    palabrasClaveSecundarias?: string[];
    faqItems?: IFAQItem[];

    // ========== Control y analytics ==========
    isActive: boolean;
    isFeatured?: boolean;
    viewCount?: number;
    avgTimeOnPage?: number; // Señal de experiencia de usuario (UX)

    createdAt?: Date;
    updatedAt?: Date;
    deletedAt?: Date | null;
}

// ========== SCHEMAS ==========

const comparisonSpecSchema = new Schema<IComparisonSpec>(
    {
        key: { type: String, required: true, trim: true },
        values: [{ type: String, required: true }],
        category: { type: String, trim: true, default: 'General' },
        explanation: { type: String, trim: true },
        isKeyDifference: { type: Boolean, default: false }
    },
    { _id: false }
);

const productEditorialSchema = new Schema<IProductEditorial>(
    {
        product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        resumenIdoneidad: {
            type: String,
            required: true,
            trim: true,
            minlength: 50,
            maxlength: 300
        },
        pros: [{ type: String, trim: true, minlength: 10 }],
        contras: [{ type: String, trim: true, minlength: 10 }]
    },
    { _id: false }
);

const faqSchema = new Schema<IFAQItem>(
    {
        pregunta: { type: String, required: true, trim: true },
        respuesta: { type: String, required: true, trim: true },
        keywords: [{ type: String, trim: true }]
    },
    { _id: false }
);

const comparisonSchema = new Schema<IComparison>(
    {
        slug: {
            type: String,
            trim: true,
            lowercase: true
        },
        title: {
            type: String,
            required: true,
            trim: true,
            minlength: 20,
            maxlength: 100
        },
        metaTitle: {
            type: String,
            trim: true,
            maxlength: 60
        },
        metaDescription: {
            type: String,
            trim: true,
            maxlength: 160
        },
        products: {
            type: [
                {
                    type: Schema.Types.ObjectId,
                    ref: 'Product'
                }
            ],
            validate: [
                (val: Types.ObjectId[]) => val.length >= 2,
                'Se requieren al menos 2 productos para realizar una comparativa.'
            ]
        },
        introduccion: { type: String, trim: true },
        veredictoRapido: { type: String, trim: true },
        conclusion: { type: String, trim: true },

        especificaciones: { type: [comparisonSpecSchema], default: [] },
        analisisEditorial: { type: [productEditorialSchema], default: [] },

        palabrasClaveSecundarias: [{ type: String, trim: true }],
        faqItems: { type: [faqSchema], default: [] },

        isActive: { type: Boolean, default: true },
        isFeatured: { type: Boolean, default: false },
        viewCount: { type: Number, default: 0, min: 0 },
        avgTimeOnPage: { type: Number, default: 0, min: 0 },

        deletedAt: { type: Date, default: null }
    },
    { timestamps: true }
);

// Índice compuesto parcial para garantizar slugs únicos sin romper el soft delete
comparisonSchema.index(
    { slug: 1 },
    {
        unique: true,
        partialFilterExpression: { deletedAt: null }
    }
);

// Índices de lectura rápida para el Feed de comparativas y mapeo inverso
comparisonSchema.index({ products: 1 });
comparisonSchema.index({ isActive: 1, isFeatured: -1, createdAt: -1 });

export default mongoose.model<IComparison>('Comparison', comparisonSchema);