//File: backend/src/models/Product.ts

import mongoose, { Schema, Document, PopulatedDoc, Types } from 'mongoose';
import { ICategory } from './Category';
import { IBrand } from './Brand';
import { IProductLine } from './ProductLine';

interface ISpecification {
    key: string;
    value: string;
}

export interface IVariant {
    _id?: Types.ObjectId;
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
    esDestacado?: boolean;
    esNuevo?: boolean;
    atributos?: Record<string, string>;
    especificaciones?: ISpecification[];
    diasEnvio?: number;
    fechaDisponibilidad?: Date;
    variants?: IVariant[];
    isFrontPage?: boolean;
}

// --- Sub-schema de especificación ---
const specificationSchema = new Schema<ISpecification>(
    {
        key: { type: String, required: true, trim: true },
        value: { type: String, required: true, trim: true }
    },
    { _id: false }
);

// --- Sub-schema de variante ---
const variantSchema = new Schema<IVariant>(
    {
        nombre: { type: String },
        precio: { type: Number, min: 0 },
        precioComparativo: { type: Number, min: 0 },
        costo: { type: Number, min: 0 },
        stock: { type: Number, min: 0, default: 0 },
        sku: { type: String, trim: true },
        barcode: { type: String, trim: true },
        imagenes: { type: [String], default: [] },

        // Corrección: usar Map para validación + estabilidad
        atributos: {
            type: Map,
            of: String,
            default: {}
        }
    },
    { _id: true }
);

// Añadir SearchIndex for searchs

// --- Schema principal ---
const productSchema = new Schema<IProduct>(
    {
        nombre: { type: String, required: true, trim: true },
        slug: { type: String, trim: true, unique: true, required: true },
        descripcion: { type: String },
        precio: { type: Number, min: 0, default: 0 },
        precioComparativo: { type: Number, min: 0 },
        costo: { type: Number, min: 0, default: 0 },
        imagenes: { type: [String], default: [] },
        categoria: { type: Types.ObjectId, ref: 'Category', required: true },
        brand: { type: Types.ObjectId, ref: 'Brand' },
        line: {
            type: Schema.Types.ObjectId,
            ref: 'ProductLine',
            index: true // Importante para filtrar rápido por línea
        }, stock: { type: Number, min: 0, default: 0 },
        sku: { type: String, trim: true },
        barcode: { type: String, trim: true },
        isActive: { type: Boolean, default: true },
        esDestacado: { type: Boolean, default: false },
        esNuevo: { type: Boolean, default: false },

        atributos: {
            type: Map,
            of: String,
            default: {}
        },

        especificaciones: { type: [specificationSchema], default: [] },

        diasEnvio: { type: Number, min: 0, default: 1 },
        fechaDisponibilidad: { type: Date },

        variants: { type: [variantSchema], default: [] },
    },
    { timestamps: true }
);

// Índices útiles
productSchema.index({ 'variants.sku': 1 });
productSchema.index({ productLine: 1 });
// productSchema.index({ slug: 1 });

export default mongoose.model<IProduct>('Product', productSchema);
