// File: backend/src/models/Product.ts

import mongoose, { Schema, Document, PopulatedDoc, Types } from 'mongoose';
import { ICategory } from './Category';
import { IBrand } from './Brand';
import { IProductLine } from './ProductLine';

// ── Interfaces ────────────────────────────────────────────────────────────────

interface ISpecification {
    key: string;
    value: string;
}

export interface IVariant {
    _id?: Types.ObjectId;
    variantId?: string;         // PRD-000001-V01
    nombre?: string;
    precio?: number;
    precioComparativo?: number;
    costo?: number;
    stock: number;
    sku?: string;
    barcode?: string;
    imagenes?: string[];
    atributos: Record<string, string>;
}

export interface IProduct extends Document {
    productId: string;          // PRD-000001
    nombre: string;
    slug: string;
    descripcion?: string;
    precio?: number;
    precioComparativo?: number;
    costo?: number;
    imagenes?: string[];
    categoria: mongoose.Types.ObjectId | PopulatedDoc<ICategory>;
    brand?: mongoose.Types.ObjectId | PopulatedDoc<IBrand>;
    line?: mongoose.Types.ObjectId | PopulatedDoc<IProductLine>;
    stock?: number;
    sku?: string;
    barcode?: string;
    isActive: boolean;
    atributos?: Record<string, string>;
    especificaciones?: ISpecification[];
    diasEnvio?: number;
    fechaDisponibilidad?: Date;
    variants?: IVariant[];
    complementarios?: (mongoose.Types.ObjectId | PopulatedDoc<IProduct>)[];
    tags?: string[];
    weight?: number;
    dimensions?: {
        length: number;
        width: number;
        height: number;
    };
    metaTitle?: string;
    metaDescription?: string;
    rating: number;
    numReviews: number;
    deletedAt?: Date;
    collections?: Types.ObjectId[];
    createdAt?: Date;
    updatedAt?: Date;
}

// ── Sub-schemas ───────────────────────────────────────────────────────────────

const specificationSchema = new Schema<ISpecification>(
    {
        key: { type: String, required: true, trim: true },
        value: { type: String, required: true, trim: true },
    },
    { _id: false }
);

const variantSchema = new Schema<IVariant>(
    {
        variantId: { type: String, trim: true },
        nombre: { type: String },
        precio: { type: Number, min: 0 },
        precioComparativo: { type: Number, min: 0 },
        costo: { type: Number, min: 0 },
        stock: { type: Number, min: 0, default: 0 },
        sku: { type: String, trim: true },
        barcode: { type: String, trim: true },
        imagenes: { type: [String], default: [] },
        atributos: {
            type: Map,
            of: String,
            default: {},
        },
    },
    { _id: true }
);

// ── Schema principal ──────────────────────────────────────────────────────────

const productSchema = new Schema<IProduct>(
    {
        productId: {
            type: String,
            unique: true,
            sparse: true,
            trim: true,
            // Se genera en el service con generateProductId()
            // Formato: PRD-000001
        },
        nombre: { type: String, required: true, trim: true },
        slug: { type: String, trim: true, unique: true, required: true },
        descripcion: { type: String },

        precio: { type: Number, min: 0, default: 0 },
        precioComparativo: { type: Number, min: 0 },
        costo: { type: Number, min: 0, default: 0 },

        imagenes: { type: [String], default: [] },

        categoria: { type: Types.ObjectId, ref: 'Category', required: true },
        brand: { type: Types.ObjectId, ref: 'Brand' },
        line: { type: Schema.Types.ObjectId, ref: 'ProductLine', index: true },

        stock: { type: Number, min: 0, default: 0 },
        sku: { type: String, trim: true },
        barcode: { type: String, trim: true },

        isActive: { type: Boolean, default: true },

        atributos: {
            type: Map,
            of: String,
            default: {},
        },

        especificaciones: { type: [specificationSchema], default: [] },

        diasEnvio: { type: Number, min: 0, default: 1 },
        fechaDisponibilidad: { type: Date },

        variants: { type: [variantSchema], default: [] },

        complementarios: [{ type: Schema.Types.ObjectId, ref: 'Product' }],

        tags: { type: [String], default: [], index: true },
        weight: { type: Number, min: 0 },
        dimensions: {
            length: { type: Number, min: 0 },
            width: { type: Number, min: 0 },
            height: { type: Number, min: 0 },
        },

        metaTitle: { type: String, trim: true, maxlength: 60 },
        metaDescription: { type: String, trim: true, maxlength: 160 },

        rating: { type: Number, min: 0, max: 5, default: 0 },
        numReviews: { type: Number, min: 0, default: 0 },

        deletedAt: { type: Date, default: null },

        collections: [{ type: Schema.Types.ObjectId, ref: 'Collection' }],
    },
    { timestamps: true }
);

// ── Índices ───────────────────────────────────────────────────────────────────

// Identificadores
productSchema.index({ productId: 1 });
productSchema.index({ sku: 1 });
productSchema.index({ barcode: 1 });
productSchema.index({ 'variants.sku': 1 });
productSchema.index({ 'variants.variantId': 1 });
productSchema.index({ 'variants.barcode': 1 });

// Filtros frecuentes
productSchema.index({ categoria: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ isActive: 1, deletedAt: 1, createdAt: -1 });

// Colecciones (best_sellers, new_arrivals, featured, on_sale)
productSchema.index({ collections: 1, isActive: 1, deletedAt: 1 });

export default mongoose.model<IProduct>('Product', productSchema);