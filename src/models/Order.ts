import mongoose, { Schema, Document, Types } from 'mongoose';
import { IUser } from './User';
import { IProduct } from './Product';

// Enums
export enum OrderStatus {
    PENDIENTE = 'PENDIENTE',
    PROCESANDO = 'PROCESANDO',
    ENVIADO = 'ENVIADO',
    ENTREGADO = 'ENTREGADO',
    CANCELADO = 'CANCELADO',
}

export enum PaymentMethod {
    MERCADOPAGO = 'MERCADOPAGO',
    TARJETA = 'TARJETA',
    TRANSFERENCIA = 'TRANSFERENCIA',
    YAPE = 'YAPE',
    PLIN = 'PLIN',
    EFECTIVO = 'EFECTIVO',
}

export enum PaymentStatus {
    PAGADO = 'PAGADO',
    PENDIENTE = 'PENDIENTE',
    CANCELADO = 'CANCELADO',
}

// Interfaces
export interface IShippingAddress {
    departamento: string;
    provincia: string;
    distrito: string;
    direccion: string;
    numero: string;
    piso?: string;
    referencia?: string;
}

export interface IOrderItem {
    productId: Types.ObjectId | IProduct;
    quantity: number;
    price: number;
}

export interface IStatusHistory {
    status: OrderStatus;
    changedAt: Date;
}

export interface IOrder extends Document {
    user: Types.ObjectId | IUser;
    items: IOrderItem[];
    subtotal: number;
    shippingCost: number;
    totalPrice: number;
    status: OrderStatus;
    statusHistory: IStatusHistory[];
    shippingAddress: IShippingAddress;
    shippingMethod: string;
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    paymentId?: string;
    trackingId?: string;
    notes?: string;
    isPrinted: boolean;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
}

// Subschemas
const shippingAddressSchema = new Schema<IShippingAddress>({
    departamento: { type: String, required: true },
    provincia: { type: String, required: true },
    distrito: { type: String, required: true },
    direccion: { type: String, required: true },
    numero: { type: String, required: true },
    piso: { type: String },
    referencia: { type: String },
}, { _id: false });

const orderItemSchema = new Schema<IOrderItem>({
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
}, { _id: false });

const statusHistorySchema = new Schema<IStatusHistory>({
    status: {
        type: String,
        enum: Object.values(OrderStatus),
        required: true
    },
    changedAt: { type: Date, default: Date.now }
}, { _id: false });

// Order Schema principal
const orderSchema = new Schema<IOrder>({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true },
    shippingCost: { type: Number, default: 0 },
    totalPrice: { type: Number, required: true },
    status: {
        type: String,
        enum: Object.values(OrderStatus),
        default: OrderStatus.PENDIENTE
    },
    statusHistory: { type: [statusHistorySchema], default: [] },
    shippingAddress: { type: shippingAddressSchema, required: true },
    shippingMethod: { type: String, default: 'DELIVERY' },
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
    paymentId: { type: String },
    trackingId: { type: String },
    notes: { type: String },
    isPrinted: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false }
}, {
    timestamps: true
});

// Índices
orderSchema.index({ user: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ trackingId: 1 });
orderSchema.index({ createdAt: -1 });

const Order = mongoose.model<IOrder>('Order', orderSchema);
export default Order;