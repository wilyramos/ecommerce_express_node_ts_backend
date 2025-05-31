import mongoose, { Schema, Document, PopulatedDoc, Types } from 'mongoose';
import { ICategory } from './Category';

export enum Brand {
    Apple = "Apple",
    Samsung = "Samsung",
    Ifans = "Ifans",
}

export enum Color {
    Negro = "Negro",
    Blanco = "Blanco",
    Azul = "Azul",
    Rojo = "Rojo",
    Verde = "Verde",
    Amarillo = "Amarillo",
    Morado = "Morado",
    Naranja = "Naranja",
}

interface Variant {
    color?: Color;
    modeloCompatible?: string;
    stock: number;
    sku?: string;
    barcode?: string;
    imagen?: string;  // Imagen específica de la variante, opcional
}

export interface IProduct extends Document {
    nombre: string;
    descripcion?: string;
    precio: number; // Precio base o fijo
    imagenes: string[];
    categoria: mongoose.Types.ObjectId | PopulatedDoc<ICategory>;
    stock: number;  // Stock total o general (si no hay variantes)
    sku?: string;
    barcode?: string;
    isActive: boolean;
    brand?: Brand;
    color?: Color; // Color general, si aplica
    variantes?: Variant[]; // Opcional: variantes si las hay
}

const variantSchema = new Schema<Variant>(
    {
        color: { type: String, enum: Object.values(Color) },
        modeloCompatible: { type: String },
        stock: { type: Number, required: true, min: 0, default: 0 },
        sku: { type: String, trim: true },
        barcode: { type: String, trim: true },
        imagen: { type: String },
    },
    { _id: false }
);

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
        brand: { type: String, enum: Object.values(Brand) },
        color: { type: String, enum: Object.values(Color) },
        variantes: [variantSchema],  // Opcional: esquema para variantes
    },
    { timestamps: true }
);

const Product = mongoose.model<IProduct>('Product', productSchema);
export default Product;