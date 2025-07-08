import mongoose, { Schema, Document, Types } from 'mongoose';
import { IUser } from './User';
import { IProduct } from './Product';
import { IOrder, PaymentMethod, PaymentStatus } from './Order';

// Fuente de la venta
export enum SaleSource {
    ONLINE = 'ONLINE',
    POS = 'POS',
}

// Estado de la venta
export enum SaleStatus {
    COMPLETADA = 'COMPLETADA',
    REEMBOLSADA = 'REEMBOLSADA',
    ANULADA = 'ANULADA',
}

// Producto vendido
interface ISaleItem {
    product: Types.ObjectId | IProduct;
    quantity: number;
    price: number; // Precio unitario
}

// Cliente sin cuenta registrada
interface ISaleCustomerSnapshot {
    nombre?: string;
    tipoDocumento?: 'DNI' | 'RUC' | 'CE';
    numeroDocumento?: string;
    telefono?: string;
    email?: string;
    direccion?: string;
}

// Historial de cambios de estado
interface ISaleStatusHistory {
    status: SaleStatus;
    changedAt: Date;
}

// Venta completa
export interface ISale extends Document {
    customer?: Types.ObjectId | IUser; // Cliente registrado
    customerSnapshot?: ISaleCustomerSnapshot; // Cliente sin cuenta
    employee?: Types.ObjectId | IUser; // Vendedor que atendió

    items: ISaleItem[];
    totalPrice: number;
    totalDiscountAmount?: number;

    receiptType?: 'BOLETA' | 'FACTURA';
    receiptNumber?: string;

    source: SaleSource;
    order?: Types.ObjectId | IOrder;

    status: SaleStatus;
    statusHistory: ISaleStatusHistory[];

    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    paymentId?: string;

    storeLocation?: string;
    deliveryMethod?: 'PICKUP' | 'DELIVERY';

    createdAt: Date;
    updatedAt: Date;
}

const saleItemSchema = new Schema<ISaleItem>({
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
}, { _id: false });

const customerSnapshotSchema = new Schema<ISaleCustomerSnapshot>({
    nombre: String,
    tipoDocumento: { type: String, enum: ['DNI', 'RUC', 'CE'] },
    numeroDocumento: String,
    telefono: String,
    email: String,
    direccion: String,
}, { _id: false });

const saleStatusHistorySchema = new Schema<ISaleStatusHistory>({
    status: { type: String, enum: Object.values(SaleStatus), required: true },
    changedAt: { type: Date, default: Date.now },
}, { _id: false });

const saleSchema = new Schema<ISale>({
    // Cliente
    customer: { type: Schema.Types.ObjectId, ref: 'User' },
    customerSnapshot: { type: customerSnapshotSchema },

    // Empleado que hizo la venta
    employee: { type: Schema.Types.ObjectId, ref: 'User' },

    // Productos vendidos
    items: { type: [saleItemSchema], required: true },

    // Totales
    totalPrice: { type: Number, min: 0 },
    totalDiscountAmount: { type: Number, default: 0, min: 0 },

    // Comprobante
    receiptType: { type: String, enum: ['BOLETA', 'FACTURA'], default: 'BOLETA' },
    receiptNumber: { type: String },

    // Origen y enlace con orden online
    source: { type: String, enum: Object.values(SaleSource), required: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order' },

    // Estado y seguimiento
    status: { type: String, enum: Object.values(SaleStatus), default: SaleStatus.COMPLETADA },
    statusHistory: { type: [saleStatusHistorySchema], default: [] },

    // Pago
    paymentMethod: { type: String, enum: Object.values(PaymentMethod), required: true },
    paymentStatus: { type: String, enum: Object.values(PaymentStatus), default: PaymentStatus.PAGADO },
    paymentId: { type: String },

    // Logística
    storeLocation: { type: String },
    deliveryMethod: { type: String, enum: ['PICKUP', 'DELIVERY'], default: 'PICKUP' },
}, {
    timestamps: true
});


// Calcular el total de la venta antes de guardar
saleSchema.pre<ISale>('save', function (next) {
    const itemsTotal = this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    this.totalPrice = Math.max(0, itemsTotal - (this.totalDiscountAmount || 0));
    next();
});

// Índices útiles
saleSchema.index({ customer: 1 });
saleSchema.index({ employee: 1 });
saleSchema.index({ order: 1 }, { sparse: true });
saleSchema.index({ createdAt: -1 });

export const Sale = mongoose.model<ISale>('Sale', saleSchema);