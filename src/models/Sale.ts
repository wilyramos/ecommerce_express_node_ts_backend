import mongoose, { Schema, Document, Types } from 'mongoose';
import { IUser } from './User';
import { IProduct } from './Product';


export interface ISale extends Document {
    user: Types.ObjectId | IUser; // Referencia al usuario que realizó la compra
    items: {
        product: Types.ObjectId | IProduct; // Referencia al producto vendido
        quantity: number; // Cantidad vendida
        price: number; // Precio de venta del producto
    }[];
    totalPrice: number; // Precio total de la venta
    createdAt: Date; // Fecha de creación de la venta
    updatedAt: Date; // Fecha de actualización de la venta
}

// TODO: 

const saleSchema = new Schema<ISale>({
    user: { type: Types.ObjectId, ref: 'User', required: true },
    items: [{
        product: { type: Types.ObjectId, ref: 'Product' }, // Referencia al modelo Product
        quantity: { type: Number, required: true },
        price: { type: Number, required: true }
    }],
    totalPrice: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

