import mongoose, { Schema, Document, Types } from 'mongoose';
import { IUser } from './User';
import { IProduct } from './Product';
import { PaymentStatus } from './Order';
import { Counter } from './Counter';


// 

// Estado de la venta
export enum SaleStatus {
    PENDING = 'PENDING',           // Venta registrada pero aún no confirmada (ej: carrito / preventa)
    COMPLETED = 'COMPLETED',       // Venta finalizada con éxito
    PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED', // Algunos productos devueltos
    REFUNDED = 'REFUNDED',         // Venta devuelta completamente
    CANCELED = 'CANCELED',         // Venta anulada antes de completarse
}

export enum PaymentMethod {
    CASH = 'CASH',
    CARD = 'CARD',
    YAPE = 'YAPE',
    PLIN = 'PLIN',
    TRANSFER = 'TRANSFER',
}


// Producto vendido
interface ISaleItem {
    product: Types.ObjectId | IProduct;
    variantId?: Types.ObjectId;

    quantity: number;
    price: number; // Precio unitario
    cost: number; // Costo unitario en el momento de la venta
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

    receiptType?: 'TICKET' | 'BOLETA' | 'FACTURA';
    receiptNumber?: string;

    status: SaleStatus;
    statusHistory: ISaleStatusHistory[];

    paymentMethod: string;
    paymentStatus: PaymentStatus;
    paymentId?: string;

    storeLocation?: string;
    deliveryMethod?: 'PICKUP' | 'DELIVERY';

    createdAt: Date;
    updatedAt: Date;
}

const saleItemSchema = new Schema<ISaleItem>({
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    cost: { type: Number, min: 0, default: 0 },
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
    receiptType: { type: String, enum: ['TICKET', 'BOLETA', 'FACTURA'], default: 'TICKET' },
    receiptNumber: { type: String },

    // Estado y seguimiento
    status: { type: String, enum: Object.values(SaleStatus), default: SaleStatus.COMPLETED },
    statusHistory: { type: [saleStatusHistorySchema], default: [] },

    // Pago
    paymentMethod: { type: String, enum: Object.values(PaymentMethod), default: PaymentMethod.CASH },

    paymentStatus: { type: String, enum: Object.values(PaymentStatus), default: PaymentStatus.APPROVED },
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

// Agregar el número de comprobante

saleSchema.pre<ISale>("save", async function (next) {
    if (!this.isNew || this.receiptNumber) return next();

    try {
        const counter = await Counter.findOneAndUpdate(
            { name: this.receiptType },
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );
        // Ejemplo: B001-00012345
        this.receiptNumber = `${this.receiptType[0]}001-${counter.seq
            .toString()
            .padStart(8, "0")}`;

        next();
    } catch (err) {
        next(err as any);
    }
});

// Índices útiles
saleSchema.index({ customer: 1 });
saleSchema.index({ employee: 1 });
saleSchema.index({ createdAt: -1 });

export const Sale = mongoose.model<ISale>('Sale', saleSchema);