// backend/src/models/product.model.ts
import mongoose, { Schema, Document, PopulatedDoc, Types } from 'mongoose';
import { ICategory } from './Category';


export enum Brand {
    Iphone = "Iphone",
    Samsung = "Samsung",
    Ifans = "Ifans",
}

export enum color {
    Black = "Black",
    White = "White",
    Blue = "Blue",
    Red = "Red",
    Green = "Green",
    Yellow = "Yellow",
    Purple = "Purple",
    Orange = "Orange",
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
    brand?: Brand;
    color?: color;
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
        barcode: { type: String, trim: true },  
        isActive: { type: Boolean, default: true }, //TODO:
        brand: { type: String, enum: Object.values(Brand)}, 
        color: { type: String, enum: Object.values(color)}
    },
    { timestamps: true }
);

const Product = mongoose.model<IProduct>('Product', productSchema);
export default Product;