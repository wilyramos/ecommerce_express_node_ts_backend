import mongoose, { Schema, Document, PopulatedDoc, Types } from 'mongoose';
import { ICategory } from './Category';


export interface VariantOption {
    nombre: string;
    valores: string[];
}

export interface Variant {
    opciones: VariantOption[];
    stock: number;
    barcode?: string;
}


export interface IProduct extends Document {
    nombre: string;
    descripcion?: string;
    precio: number;
    imagenes: string[];
    categoria: mongoose.Types.ObjectId | PopulatedDoc<ICategory>;
    stock: number;
    sku?: string;
    barcode?: string;
    isActive: boolean;
    variantes?: Variant[];
    esDestacado?: boolean;
    esNuevo?: boolean;
    atributos?: Record<string, string>;
}

// Subschemas
const variantOptionSchema = new Schema<VariantOption>(
    {
        nombre: { type: String, required: true },
        valores: [{ type: String, required: true }]
    },
    { _id: false }
);

const variantSchema = new Schema<Variant>(
    {
        opciones: [variantOptionSchema],
        stock: { type: Number, required: true, min: 0 },
        barcode: { type: String, trim: true },
    },
    { _id: false }
);

// Producto principal
const productSchema = new Schema<IProduct>(
    {
        nombre: { type: String, required: true, trim: true },
        descripcion: { type: String, trim: true },
        precio: { type: Number, required: true, min: 0 },
        imagenes: [{ type: String }],
        categoria: { type: Types.ObjectId, ref: 'Category', required: true },
        stock: { type: Number, required: true, min: 0, default: 0 },
        sku: { type: String, trim: true },
        barcode: { type: String, trim: true },
        isActive: { type: Boolean, default: true },
        variantes: [variantSchema],
        esDestacado: { type: Boolean, default: false },
        esNuevo: { type: Boolean, default: false },
        atributos: { type: Map, of: String, default: {} }, // Atributos personalizados como un mapa clave-valor
    },
    { timestamps: true }
);

const Product = mongoose.model<IProduct>('Product', productSchema);
export default Product;