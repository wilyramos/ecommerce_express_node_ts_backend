import mongoose, { Schema, Document, PopulatedDoc, Types } from 'mongoose';
import { ICategory } from './Category';


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
    esDestacado?: boolean;
    esNuevo?: boolean;
    atributos?: Record<string, string>;
}

// Subschemas

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
        esDestacado: { type: Boolean, default: false },
        esNuevo: { type: Boolean, default: false },
        atributos: { type: Map, of: String, default: {} },
    },
    { timestamps: true }
);

const Product = mongoose.model<IProduct>('Product', productSchema);
export default Product;