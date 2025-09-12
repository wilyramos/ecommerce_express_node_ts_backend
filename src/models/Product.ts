import mongoose, { Schema, Document, PopulatedDoc, Types } from 'mongoose';
import { ICategory } from './Category';

interface ISpecification {
    key: string;
    value: string;
}

export interface IProduct extends Document {
    nombre: string;
    slug: string;
    descripcion?: string;
    precio?: number;
    costo?: number;
    imagenes?: string[];
    categoria: mongoose.Types.ObjectId | PopulatedDoc<ICategory>;
    stock?: number;
    sku?: string;
    barcode?: string;
    isActive: boolean;
    esDestacado?: boolean;
    esNuevo?: boolean;
    atributos?: Record<string, string>;
    especificaciones?: ISpecification[];
}

// --- Sub-schema de especificación ---
const specificationSchema = new Schema<ISpecification>(
    {
        key: { type: String, required: true, trim: true },
        value: { type: String, required: true, trim: true },
    },
    { _id: false } // no necesitamos un _id para cada especificación
);

// --- Schema principal del producto ---
const productSchema = new Schema<IProduct>(
    {
        nombre: { type: String, required: true, trim: true },
        slug: { type: String, trim: true, unique: true },
        descripcion: { type: String, trim: true },
        precio: { type: Number, min: 0, default: 0 },
        costo: { type: Number, min: 0, default: 0 },
        imagenes: [{ type: String }],
        categoria: { type: Types.ObjectId, ref: 'Category', required: true },
        stock: { type: Number, min: 0, default: 0 },
        sku: { type: String, trim: true },
        barcode: { type: String, trim: true },
        isActive: { type: Boolean, default: true },
        esDestacado: { type: Boolean, default: false },
        esNuevo: { type: Boolean, default: false },
        atributos: { type: Map, of: String, default: {} },
        especificaciones: [specificationSchema],
    },
    { timestamps: true }
);

export default mongoose.model<IProduct>('Product', productSchema);