import mongoose, { Schema, Document, Types } from 'mongoose';
import { IUser } from './User';
import { IProduct } from './Product';

// Estados de orden y pago
export enum OrderStatus {
    AWAITING_PAYMENT = 'awaiting_payment',
    PROCESSING = 'processing',
    SHIPPED = 'shipped',
    DELIVERED = 'delivered',
    CANCELED = 'canceled'
}

export enum PaymentStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    REJECTED = 'rejected',
    REFUNDED = 'refunded'
}

// Interfaces
export interface IShippingAddress {
    departamento: string;
    provincia: string;
    distrito: string;
    direccion: string;
    numero?: string;
    pisoDpto?: string;
    referencia?: string;
}

export interface IOrderItem {
    productId: Types.ObjectId | IProduct;
    quantity: number;
    price: number;
}

export interface IPaymentInfo {
    provider: string;        // Ej: 'IZIPAY', 'MERCADOPAGO', 'STRIPE'
    method?: string;         // Ej: 'visa', 'yape'
    transactionId?: string;  // ID que devuelve la pasarela
    status: PaymentStatus;
    rawResponse?: any;       // Respuesta completa para debugging
}

export interface IStatusHistory {
    status: OrderStatus;
    changedAt: Date;
}

export interface IOrder extends Document {
    orderNumber: string;
    user: Types.ObjectId | IUser;
    items: IOrderItem[];
    subtotal: number;
    shippingCost: number;
    totalPrice: number;
    currency: string;
    status: OrderStatus;
    statusHistory: IStatusHistory[];
    shippingAddress: IShippingAddress;
    payment: IPaymentInfo;
    createdAt: Date;
    updatedAt: Date;
}

// Schemas
const shippingAddressSchema = new Schema<IShippingAddress>({
    departamento: { type: String, required: true },
    provincia: { type: String, required: true },
    distrito: { type: String, required: true },
    direccion: { type: String, required: true },
    referencia: { type: String }
}, { _id: false });

const orderItemSchema = new Schema<IOrderItem>({
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true }
}, { _id: false });

const paymentSchema = new Schema<IPaymentInfo>({
    provider: { type: String, required: true },
    method: { type: String },
    transactionId: { type: String },
    status: { type: String, enum: Object.values(PaymentStatus), default: PaymentStatus.PENDING },
    rawResponse: { type: Schema.Types.Mixed }
}, { _id: false });

const statusHistorySchema = new Schema<IStatusHistory>({
    status: { type: String, enum: Object.values(OrderStatus), required: true },
    changedAt: { type: Date, default: Date.now }
}, { _id: false });

// Order principal
const orderSchema = new Schema<IOrder>({
    orderNumber: { type: String, unique: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true },
    shippingCost: { type: Number, default: 0 },
    totalPrice: { type: Number, required: true },
    currency: { type: String, default: 'PEN' },
    status: { type: String, enum: Object.values(OrderStatus), default: OrderStatus.AWAITING_PAYMENT },
    statusHistory: { type: [statusHistorySchema], default: [] },
    shippingAddress: { type: shippingAddressSchema, required: true },
    payment: { type: paymentSchema, required: true }
}, { timestamps: true });

// Índices útiles
orderSchema.index({ user: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ 'payment.transactionId': 1 });

const Order = mongoose.model<IOrder>('Order', orderSchema);
export default Order;
