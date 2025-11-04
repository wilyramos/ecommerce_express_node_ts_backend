import mongoose, { Schema, Document, PopulatedDoc, Types } from 'mongoose';
import { ICategory } from './Category';
import { IBrand } from './Brand';

interface ISpecification {
    key: string;
    value: string;
}

export interface IVariant {
    nombre?: string; // Ej: "Rojo / 128GB"
    precio?: number;
    precioComparativo?: number;
    stock: number;
    sku?: string;
    barcode?: string;
    imagenes?: string[];
    atributos: Record<string, string>; // { color: "Rojo", almacenamiento: "128GB" }
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
    variants?: IVariant[]; // Variants 
}

// --- Sub-schema de especificación ---
const specificationSchema = new Schema<ISpecification>(
    {
        key: { type: String, required: true, trim: true },
        value: { type: String, required: true, trim: true },
    },
    { _id: false }
);

// --- Sub-schema de variante ---
const variantSchema = new Schema<IVariant>(
    {
        nombre: { type: String },
        precio: { type: Number, min: 0 },
        precioComparativo: { type: Number, min: 0 },
        stock: { type: Number, min: 0, default: 0 },
        sku: { type: String, trim: true },
        barcode: { type: String, trim: true },
        imagenes: [{ type: String }],
        atributos: { type: Map, of: String, default: {} },
    },
    { _id: true } // Necesitamos ID para poder hacer referencia en órdenes
);

// --- Schema principal del producto ---
const productSchema = new Schema<IProduct>(
    {
        nombre: { type: String, required: true, trim: true },
        slug: { type: String, trim: true, unique: true },
        descripcion: { type: String },
        precio: { type: Number, min: 0, default: 0 },
        precioComparativo: { type: Number, min: 0 },
        costo: { type: Number, min: 0, default: 0 },
        imagenes: [{ type: String }],
        categoria: { type: Types.ObjectId, ref: 'Category', required: true },
        brand: { type: Types.ObjectId, ref: 'Brand' },
        stock: { type: Number, min: 0, default: 0 },
        sku: { type: String, trim: true },
        barcode: { type: String, trim: true },
        isActive: { type: Boolean, default: true },
        esDestacado: { type: Boolean, default: false },
        esNuevo: { type: Boolean, default: false },
        atributos: { type: Map, of: String, default: {} },
        especificaciones: [specificationSchema],
        diasEnvio: { type: Number, min: 0, default: 1 },
        fechaDisponibilidad: { type: Date },
        variants: [variantSchema], // Variants
    },
    { timestamps: true }
);

productSchema.index({ 'variants.sku': 1 });
productSchema.index({ 'variants.atributos': 1 });

export default mongoose.model<IProduct>('Product', productSchema);
