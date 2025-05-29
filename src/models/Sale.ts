import mongoose, { Schema, Document, Types } from 'mongoose';
import { IUser } from './User';
import { IProduct } from './Product';
import { IOrder, PaymentMethod, PaymentStatus } from './Order';

export enum SaleSource {
    ONLINE = 'ONLINE',
    POS = 'POS',
}

export enum SaleStatus {
    COMPLETADA = 'COMPLETADA',
    REEMBOLSADA = 'REEMBOLSADA',
    ANULADA = 'ANULADA',
}

interface ISaleItem {
    product: Types.ObjectId | IProduct;
    quantity: number;
    price: number;
}

export interface ISale extends Document {
    customerDNI?: string; 
    employee?: Types.ObjectId | IUser;
    items: ISaleItem[];
    totalPrice: number;
    totalDiscountAmount?: number;
    source: SaleSource;
    order?: Types.ObjectId | IOrder;
    status: SaleStatus;
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    createdAt: Date;
    updatedAt: Date;
}

const saleItemSchema = new Schema<ISaleItem>({
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
}, { _id: false });

const saleSchema = new Schema<ISale>({
    customerDNI: { type: String, required: false }, // DNI del cliente
    employee: { type: Schema.Types.ObjectId, ref: 'User' },
    items: { type: [saleItemSchema], required: true },
    totalPrice: { type: Number, min: 0 },
    totalDiscountAmount: { type: Number, default: 0, min: 0 },
    source: { type: String, enum: Object.values(SaleSource), required: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order' },
    status: { type: String, enum: Object.values(SaleStatus), default: SaleStatus.COMPLETADA },
    paymentMethod: { type: String, enum: Object.values(PaymentMethod), required: true },
    paymentStatus: { type: String, enum: Object.values(PaymentStatus), default: PaymentStatus.PAGADO },
}, { timestamps: true });

saleSchema.pre<ISale>('save', function (next) {
    const itemsTotal = this.items.reduce((sum, item) => {
        return sum + item.price * item.quantity;
    }, 0);
    this.totalPrice = Math.max(0, itemsTotal - (this.totalDiscountAmount || 0));
    next();
});

saleSchema.index({ customer: 1 });
saleSchema.index({ employee: 1 });
saleSchema.index({ source: 1 });
saleSchema.index({ createdAt: -1 });
saleSchema.index({ order: 1 }, { sparse: true });

export const Sale = mongoose.model<ISale>('Sale', saleSchema);