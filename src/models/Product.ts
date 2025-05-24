// backend/src/models/product.model.ts
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
    isActive: boolean; // TODO: Implementar en el frontend
}

const productSchema = new Schema<IProduct>(
    {
        nombre: { type: String, required: true, trim: true },
        descripcion: { type: String, trim: true },
        precio: { 
            type: Number, 
            required: true, 
            min: 0 
        },
        imagenes: [{ type: String }],
        categoria: { 
            type: Types.ObjectId,
            ref: 'Category', 
            required: true 
        }, // Referencia al modelo Category
        stock: { type: Number, required: true, min: 0, default: 0 },
        sku: { type: String, trim: true },
        isActive: { type: Boolean, default: true }, //TODO:
    },
    { timestamps: true }
);

const Product = mongoose.model<IProduct>('Product', productSchema);
export default Product;