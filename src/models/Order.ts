import mongoose, { Schema, Document, PopulatedDoc, Types } from 'mongoose';
import { IUser } from './User';
import { IProduct } from './Product';

export enum OrderStatus {
    PENDIENTE = 'PENDIENTE',
    PROCESANDO = 'PROCESANDO',
    ENVIADO = 'ENVIADO',
    ENTREGADO = 'ENTREGADO',
    CANCELADO = 'CANCELADO',
}

// Shipping address
export interface IShippingAddress {
    direccion: string;
    ciudad: string;
    telefono?: string; // Opcional
    // TODO: Agregar más campos si es necesario (ej. código postal, país, etc.)
}

export interface IOrderItem {
    product: PopulatedDoc<IProduct & Document>;
    quantity: number;
    price: number; // Precio del producto en el momento de la orden
}

export interface IOrder extends Document {
    user: Types.ObjectId | PopulatedDoc<IUser & Document>;
    items: IOrderItem[];
    totalPrice: number;
    status: OrderStatus;
    shippingAddress: IShippingAddress; // Dirección de envío
    paymentMethod: string;
    paymentStatus: string; // Ejemplo: 'Pagado', 'Pendiente', etc.
    //TODO: TRackId: string; // ID de seguimiento del envío (opcional)
}

const orderItemSchema = new Schema<IOrderItem>({
    product: { type: Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 } // Precio del producto en el momento de la orden
}, { _id: false }); // No queremos un _id para cada item

const orderSchema = new Schema<IOrder>({
    user: { type: Types.ObjectId, ref: 'User', required: true },
    items: [orderItemSchema],
    totalPrice: { type: Number, required: true, min: 0 },
    status: { type: String, enum: Object.values(OrderStatus), default: OrderStatus.PENDIENTE },
    shippingAddress: {
        direccion: { type: String, required: true },
        ciudad: { type: String, required: true },
        telefono: { type: String, required: true },
    },
    paymentMethod: { type: String, required: true },
    paymentStatus: { type: String, default: "Pendiente" }, // Ejemplo de estado de pago
    //TODO: TTrackId: { type: String } // ID de seguimiento del envío (opcional)
}, { timestamps: true });

const Order = mongoose.model<IOrder>('Order', orderSchema);
export default Order;