import mongoose, { Schema, Document, Types } from 'mongoose';
import { IUser } from './User';
import { IProduct } from './Product';

// Estado de la orden
export enum OrderStatus {
    PENDIENTE = 'PENDIENTE',
    PROCESANDO = 'PROCESANDO',
    ENVIADO = 'ENVIADO',
    ENTREGADO = 'ENTREGADO',
    CANCELADO = 'CANCELADO',
}

// Métodos de pago disponibles
export enum PaymentMethod {
    MERCADOPAGO = 'MERCADOPAGO',
    TARJETA = 'TARJETA',
    TRANSFERENCIA = 'TRANSFERENCIA',
    YAPE = 'YAPE',
    PLIN = 'PLIN',
}

// Estado del pago
export enum PaymentStatus {
    PAGADO = 'PAGADO',
    PENDIENTE = 'PENDIENTE',
    CANCELADO = 'CANCELADO'
}

// Dirección de envío
export interface IShippingAddress {
    departamento?: string;
    provincia?: string; 
    distrito?: string;
    direccion: string;
    numero?: string;
    piso?: string;
    referencia?: string;
}

// Cusomer info

export type CustomerInfo = {
    email: string;
    nombre: string;
    apellidos: string;
    telefono: string;
    tipoDocumento: "DNI" | "RUC" | "CE";
    numeroDocumento: string;
}



// Ítem dentro de una orden (producto + cantidad + precio en ese momento)
export interface IOrderItem {
    product: Types.ObjectId | IProduct; // Para hacer populate
    quantity: number;
    price: number;
}

// Orden completa
export interface IOrder extends Document {
    user: Types.ObjectId | IUser;
    items: IOrderItem[];
    totalPrice: number;
    status: OrderStatus;
    shippingAddress: IShippingAddress;
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    trackingId?: string;
    createdAt: Date;
    updatedAt: Date;
}

// Subesquema: Dirección de envío
const shippingAddressSchema = new Schema<IShippingAddress>({
    departamento: { type: String, required: true },
    provincia: { type: String, required: true },
    distrito: { type: String, required: true },
    direccion: { type: String, required: true },
    numero: { type: String, required: true },
    piso: { type: String, required: true },
    referencia: { type: String, required: true }
}, { _id: false }); // No necesita un _id propio

// Subesquema: Ítem de la orden
const orderItemSchema = new Schema<IOrderItem>({
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
}, { _id: false });

// Esquema principal de la orden
const orderSchema = new Schema<IOrder>({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: false },
    items: { type: [orderItemSchema], required: true },
    totalPrice: { type: Number, required: true, min: 0 },
    status: {
        type: String,
        enum: Object.values(OrderStatus),
        default: OrderStatus.PENDIENTE
    },
    shippingAddress: { type: shippingAddressSchema, required: true },
    paymentMethod: {
        type: String,
        enum: Object.values(PaymentMethod),
        required: true
    },
    paymentStatus: {
        type: String,
        enum: Object.values(PaymentStatus),
        default: PaymentStatus.PENDIENTE
    },
    trackingId: { type: String, default: null }
}, {
    timestamps: true
});

// Índices útiles para consultas frecuentes
orderSchema.index({ user: 1 });
orderSchema.index({ status: 1 });

// Exportación del modelo
const Order = mongoose.model<IOrder>('Order', orderSchema);
export default Order;
