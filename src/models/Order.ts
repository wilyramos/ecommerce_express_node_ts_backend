// File: backend/src/models/Order.ts

import mongoose, { Schema, Document, Types } from 'mongoose';
import { IUser } from './User';
import { IProduct } from './Product';

export enum OrderStatus {
    AWAITING_PAYMENT = 'awaiting_payment',
    PROCESSING = 'processing',
    SHIPPED = 'shipped',
    DELIVERED = 'delivered',
    CANCELED = 'canceled',
    PAID_BUT_OUT_OF_STOCK = 'paid_but_out_of_stock'
}

export enum PaymentStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    REJECTED = 'rejected',
    REFUNDED = 'refunded'
}

export interface IShippingAddress {
    departamento: string;
    provincia: string;
    distrito: string;
    direccion: string;
    numero?: string;
    pisoDpto?: string;
    referencia?: string;
}

export interface ICustomerProfile {
    nombre: string;
    apellidos: string;
    email: string;
    telefono: string;
    tipoDocumento?: string;
    numeroDocumento?: string;
}

export interface IOrderItem {
    productId: Types.ObjectId | IProduct;
    variantId?: Types.ObjectId;
    variantAttributes?: Record<string, string>;
    quantity: number;
    price: number;
    nombre: string;
    imagen?: string;
    sku?: string;
    barcode?: string;
}

export interface IPaymentInfo {
    provider: string;
    method?: string;
    transactionId?: string;
    status: PaymentStatus;
    rawResponse?: any;
}

export interface IStatusHistory {
    status: OrderStatus;
    changedAt: Date;
    actionBy?: Types.ObjectId | string;
    reason?: string;
}

export interface IDeviceInfo {
    ipAddress?: string;
    userAgent?: string;
}

export interface IInvoiceInfo {
    tipo: 'boleta' | 'factura' | 'nota_credito' | 'anulacion';
    serie: string;
    numero: number;
    pdfUrl?: string | null;
    xmlUrl?: string | null;
    cdrUrl?: string | null;
    nubefactEnlace?: string | null;
    sunatResponseCode?: string | null;
    sunatDescription?: string | null;
    sunatTicketNumero?: string | null;
    generatedAt: Date;
}

export interface IOrder extends Document {
    orderNumber: string;
    culqiOrderId?: string;
    user?: Types.ObjectId | IUser;
    customerProfile: ICustomerProfile;
    items: IOrderItem[];
    subtotal: number;
    shippingCost: number;
    totalPrice: number;
    currency: string;
    status: OrderStatus;
    statusHistory: IStatusHistory[];
    shippingAddress: IShippingAddress;
    shippingMethod?: string;
    estimatedDeliveryDate?: Date;
    payment?: IPaymentInfo;
    trackingNumber?: string;
    notes?: string;
    invoice?: IInvoiceInfo;
    creditNote?: IInvoiceInfo;
    voidInfo?: IInvoiceInfo;
    canceledAt?: Date;
    canceledBy?: Types.ObjectId | string;
    cancelReason?: string;
    deviceInfo?: IDeviceInfo;
    createdAt: Date;
    updatedAt: Date;
}

const shippingAddressSchema = new Schema<IShippingAddress>({
    departamento: { type: String, required: true },
    provincia: { type: String, required: true },
    distrito: { type: String, required: true },
    direccion: { type: String, required: true },
    numero: { type: String },
    pisoDpto: { type: String },
    referencia: { type: String }
}, { _id: false });

const customerProfileSchema = new Schema<ICustomerProfile>({
    nombre: { type: String, required: true, trim: true },
    apellidos: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    telefono: { type: String, required: true, trim: true },
    tipoDocumento: { type: String, enum: ['DNI', 'RUC', 'CE'] },
    numeroDocumento: { type: String }
}, { _id: false });

const orderItemSchema = new Schema<IOrderItem>({
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId },
    variantAttributes: { type: Map, of: String },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    nombre: { type: String, required: true },
    imagen: { type: String },
    sku: { type: String },
    barcode: { type: String }
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
    changedAt: { type: Date, default: Date.now },
    actionBy: { type: Schema.Types.Mixed },
    reason: { type: String, trim: true }
}, { _id: false });

const deviceInfoSchema = new Schema<IDeviceInfo>({
    ipAddress: { type: String },
    userAgent: { type: String }
}, { _id: false });

const invoiceSchema = new Schema<IInvoiceInfo>({
    tipo: { type: String, enum: ['boleta', 'factura', 'nota_credito', 'anulacion'], required: true },
    serie: { type: String, required: true, trim: true },
    numero: { type: Number, required: true },
    pdfUrl: { type: String, trim: true, default: null },
    xmlUrl: { type: String, trim: true, default: null },
    cdrUrl: { type: String, trim: true, default: null },
    nubefactEnlace: { type: String, trim: true, default: null },
    sunatResponseCode: { type: String, trim: true, default: null },
    sunatDescription: { type: String, trim: true, default: null },
    sunatTicketNumero: { type: String, trim: true, default: null },
    generatedAt: { type: Date, default: Date.now }
}, { _id: false });

const orderSchema = new Schema<IOrder>({
    orderNumber: { type: String, unique: true, required: true },
    culqiOrderId: { type: String, trim: true, required: false },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: false },
    customerProfile: { type: customerProfileSchema, required: true },
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true },
    shippingCost: { type: Number, default: 0 },
    totalPrice: { type: Number, required: true },
    currency: { type: String, default: 'PEN' },
    status: { type: String, enum: Object.values(OrderStatus), default: OrderStatus.AWAITING_PAYMENT },
    statusHistory: { type: [statusHistorySchema], default: [] },
    shippingAddress: { type: shippingAddressSchema, required: true },
    shippingMethod: { type: String, trim: true },
    estimatedDeliveryDate: { type: Date },
    payment: { type: paymentSchema, required: false },
    trackingNumber: { type: String, trim: true },
    notes: { type: String, trim: true, maxlength: 300 },
    invoice: { type: invoiceSchema, required: false },
    creditNote: { type: invoiceSchema, required: false },
    voidInfo: { type: invoiceSchema, required: false },
    canceledAt: { type: Date },
    canceledBy: { type: Schema.Types.Mixed },
    cancelReason: { type: String, trim: true },
    deviceInfo: { type: deviceInfoSchema, required: false }
}, { timestamps: true });

orderSchema.index({ user: 1 }, { sparse: true });
orderSchema.index({ status: 1 });
orderSchema.index({ 'payment.transactionId': 1 }, { sparse: true });
orderSchema.index({ trackingNumber: 1 }, { sparse: true });
orderSchema.index({ 'customerProfile.email': 1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ culqiOrderId: 1 }, { sparse: true });
orderSchema.index({ 'invoice.serie': 1, 'invoice.numero': 1 }, { sparse: true });
orderSchema.index({ createdAt: -1 });

const Order = mongoose.model<IOrder>('Order', orderSchema);

export default Order;