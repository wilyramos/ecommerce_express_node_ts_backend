// File: backend/src/modules/order/order.service.ts

import { FilterQuery, Types, UpdateQuery } from 'mongoose';
import Order, { IOrder, IOrderItem, OrderStatus, PaymentStatus } from '../../models/Order';
import Product from '../../models/Product';
import { generateSecureOrderNumber } from '../../utils/orderNumber-helper';

// ── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateOrderDTO {
    userId?: string;
    customerProfile: {
        nombre: string;
        apellidos: string;
        email: string;
        telefono: string;
        tipoDocumento?: string;
        numeroDocumento?: string;
    };
    items: {
        productId: string;
        variantId?: string;
        quantity: number;
    }[];
    shippingAddress: {
        departamento: string;
        provincia: string;
        distrito: string;
        direccion: string;
        numero?: string;
        pisoDpto?: string;
        referencia?: string;
    };
    notes?: string;
    currency?: string;
}

export interface OrderFilters {
    status?: OrderStatus;
    paymentStatus?: PaymentStatus;
    email?: string;
    userId?: string;
    orderNumber?: string;
    page?: number;
    limit?: number;
    from?: string;
    to?: string;
}

export interface OrderStats {
    totalOrders: number;
    totalRevenue: number;
    byStatus: Record<string, number>;
    byPaymentStatus: Record<string, number>;
}

// ── Servicio ──────────────────────────────────────────────────────────────────

export const orderService = {

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Crear orden
    // ─────────────────────────────────────────────────────────────────────────
    async createOrder(dto: CreateOrderDTO): Promise<IOrder> {
        const orderNumber = generateSecureOrderNumber();
        const items: IOrderItem[] = [];
        let subtotal = 0;

        for (const item of dto.items) {
            const dbProduct = await Product.findOne({
                _id: item.productId,
                isActive: true,
                deletedAt: null,
            }).lean();

            if (!dbProduct) {
                throw new Error(`El producto con ID ${item.productId} no está disponible.`);
            }

            let finalPrice = dbProduct.precio || 0;
            let finalNombre = dbProduct.nombre;
            let finalSku = dbProduct.sku;
            let finalBarcode = dbProduct.barcode;
            let finalImagen = dbProduct.imagenes?.[0] || undefined;
            let variantAttributesObj: Record<string, string> = {};

            if (item.variantId) {
                const variant = dbProduct.variants?.find(
                    (v) => v._id?.toString() === item.variantId
                );
                if (!variant) {
                    throw new Error(
                        `La variante especificada para "${dbProduct.nombre}" no existe.`
                    );
                }
                if (variant.stock < item.quantity) {
                    throw new Error(`Stock insuficiente para la variante de "${dbProduct.nombre}".`);
                }

                if (variant.precio) finalPrice = variant.precio;
                if (variant.sku) finalSku = variant.sku;
                if (variant.barcode) finalBarcode = variant.barcode;
                if (variant.imagenes?.[0]) finalImagen = variant.imagenes[0];

                const rawAttributes = variant.atributos || {};
                variantAttributesObj = Object.fromEntries(
                    Object.entries(rawAttributes).map(([k, v]) => [String(k), String(v)])
                );

                const attrStrings = Object.entries(variantAttributesObj)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(', ');
                finalNombre = attrStrings
                    ? `${dbProduct.nombre} (${attrStrings})`
                    : dbProduct.nombre;
            } else {
                if ((dbProduct.stock || 0) < item.quantity) {
                    throw new Error(`Stock insuficiente para el producto "${dbProduct.nombre}".`);
                }
            }

            subtotal += finalPrice * item.quantity;

            items.push({
                productId: new Types.ObjectId(item.productId),
                variantId: item.variantId ? new Types.ObjectId(item.variantId) : undefined,
                variantAttributes: item.variantId ? variantAttributesObj : undefined,
                quantity: item.quantity,
                price: finalPrice,
                nombre: finalNombre,
                imagen: finalImagen,
                sku: finalSku,
                barcode: finalBarcode,
            });
        }

        // TODO: implementar lógica de costo de envío real
        const shippingCost = 0;
        const totalPrice = subtotal + shippingCost;

        return Order.create({
            orderNumber,
            user: dto.userId ? new Types.ObjectId(dto.userId) : undefined,
            customerProfile: dto.customerProfile,
            items,
            subtotal,
            shippingCost,
            totalPrice,
            currency: dto.currency ?? 'PEN',
            shippingAddress: dto.shippingAddress,
            notes: dto.notes,
            status: OrderStatus.AWAITING_PAYMENT,
            statusHistory: [{ status: OrderStatus.AWAITING_PAYMENT, changedAt: new Date() }],
        });
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Obtener orden por ObjectId
    // ─────────────────────────────────────────────────────────────────────────
    async getOrderById(orderId: string): Promise<IOrder | null> {
        return Order.findById(orderId)
            .populate('user', 'nombre apellidos email')
            .lean();
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Obtener orden por número comercial (ORD-...)
    // ─────────────────────────────────────────────────────────────────────────
    async getOrderByNumber(orderNumber: string): Promise<IOrder | null> {
        return Order.findOne({ orderNumber })
            .populate('user', 'nombre apellidos email')
            .lean();
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Historial paginado de un usuario registrado
    // ─────────────────────────────────────────────────────────────────────────
    async getOrdersByUser(
        userId: string,
        page = 1,
        limit = 10
    ): Promise<{ orders: IOrder[]; total: number }> {
        const skip = (page - 1) * limit;
        const query = { user: new Types.ObjectId(userId) };
        const [orders, total] = await Promise.all([
            Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            Order.countDocuments(query),
        ]);
        return { orders, total };
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Historial paginado de invitado por email
    // ─────────────────────────────────────────────────────────────────────────
    async getOrdersByEmail(
        email: string,
        page = 1,
        limit = 10
    ): Promise<{ orders: IOrder[]; total: number }> {
        const skip = (page - 1) * limit;
        const query = { 'customerProfile.email': email.toLowerCase() };
        const [orders, total] = await Promise.all([
            Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            Order.countDocuments(query),
        ]);
        return { orders, total };
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 6. Listado admin con filtros y rangos de fecha
    // ─────────────────────────────────────────────────────────────────────────
    async getAllOrders(
        filters: OrderFilters
    ): Promise<{ orders: IOrder[]; total: number }> {
        const { status, paymentStatus, email, userId, orderNumber, page = 1, limit = 20, from, to } = filters;
        const skip = (page - 1) * limit;
        const query: FilterQuery<IOrder> = {};

        if (status) query.status = status;
        if (paymentStatus) query['payment.status'] = paymentStatus;
        if (email) query['customerProfile.email'] = email.toLowerCase();
        if (userId) query.user = new Types.ObjectId(userId);
        if (orderNumber) query.orderNumber = { $regex: orderNumber, $options: 'i' };

        if (from || to) {
            query.createdAt = {};
            if (from) query.createdAt.$gte = new Date(from);
            if (to) {
                const endDate = new Date(to);
                endDate.setHours(23, 59, 59, 999);
                query.createdAt.$lte = endDate;
            }
        }

        const [orders, total] = await Promise.all([
            Order.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('user', 'nombre apellidos email')
                .lean(),
            Order.countDocuments(query),
        ]);

        return { orders, total };
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 7. Actualizar estado logístico
    // ─────────────────────────────────────────────────────────────────────────
    async updateOrderStatus(
        orderId: string,
        newStatus: OrderStatus
    ): Promise<IOrder | null> {
        return Order.findByIdAndUpdate(
            orderId,
            {
                status: newStatus,
                $push: { statusHistory: { status: newStatus, changedAt: new Date() } },
            },
            { new: true }
        );
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 8. Asignar tracking de paquetería
    // ─────────────────────────────────────────────────────────────────────────
    async assignTracking(
        orderId: string,
        trackingNumber: string
    ): Promise<IOrder | null> {
        return Order.findByIdAndUpdate(
            orderId,
            {
                trackingNumber,
                status: OrderStatus.SHIPPED,
                $push: { statusHistory: { status: OrderStatus.SHIPPED, changedAt: new Date() } },
            },
            { new: true }
        );
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 9. Actualizar estado de pago (consumido por webhooks)
    // ─────────────────────────────────────────────────────────────────────────
    async updatePayment(
        orderId: string,
        paymentData: {
            provider: string;
            method?: string;
            transactionId: string;
            status: PaymentStatus;
            rawResponse?: unknown;
        }
    ): Promise<IOrder | null> {
        const newOrderStatus =
            paymentData.status === PaymentStatus.APPROVED
                ? OrderStatus.PROCESSING
                : paymentData.status === PaymentStatus.REJECTED
                ? OrderStatus.CANCELED
                : undefined;

        const update: UpdateQuery<IOrder> = { $set: { payment: paymentData } };

        if (newOrderStatus) {
            update.$set = { ...update.$set, status: newOrderStatus };
            update.$push = {
                statusHistory: { status: newOrderStatus, changedAt: new Date() },
            };
        }

        return Order.findByIdAndUpdate(orderId, update, { new: true });
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 10. Cancelación atómica con restitución de stock
    // ─────────────────────────────────────────────────────────────────────────
    async cancelOrder(orderId: string): Promise<IOrder | null> {
        const order = await Order.findOneAndUpdate(
            {
                _id: orderId,
                status: { $nin: [OrderStatus.DELIVERED, OrderStatus.CANCELED] },
            },
            {
                status: OrderStatus.CANCELED,
                $push: { statusHistory: { status: OrderStatus.CANCELED, changedAt: new Date() } },
            },
            { new: true }
        );

        if (!order) {
            const exists = await Order.findById(orderId);
            if (!exists) return null;
            throw new Error('La orden no se puede cancelar en su estado logístico actual.');
        }

        const teniaStockDescontado = order.statusHistory.some(
            (h) =>
                h.status === OrderStatus.PROCESSING ||
                h.status === OrderStatus.PAID_BUT_OUT_OF_STOCK
        );

        if (teniaStockDescontado) {
            for (const item of order.items) {
                if (item.variantId) {
                    await Product.updateOne(
                        { _id: item.productId, 'variants._id': item.variantId },
                        { $inc: { 'variants.$.stock': item.quantity } }
                    );
                } else {
                    await Product.updateOne(
                        { _id: item.productId },
                        { $inc: { stock: item.quantity } }
                    );
                }
            }
        }

        return order;
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 11. Marcar orden como reembolsada
    // ─────────────────────────────────────────────────────────────────────────
    async refundOrder(orderId: string): Promise<IOrder | null> {
        const order = await Order.findById(orderId);
        if (!order) return null;

        if (order.payment?.status !== PaymentStatus.APPROVED) {
            throw new Error('Solo se pueden reembolsar órdenes con pago aprobado.');
        }

        if (order.status === OrderStatus.DELIVERED) {
            throw new Error('No se puede reembolsar una orden ya entregada desde este panel. Gestiona el reembolso manualmente en la pasarela de pago.');
        }

        return Order.findByIdAndUpdate(
            orderId,
            {
                $set: { 'payment.status': PaymentStatus.REFUNDED },
                status: OrderStatus.CANCELED,
                $push: { statusHistory: { status: OrderStatus.CANCELED, changedAt: new Date() } },
            },
            { new: true }
        );
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 12. Agregar o actualizar nota interna de admin sobre la orden
    // ─────────────────────────────────────────────────────────────────────────
    async updateNote(orderId: string, notes: string): Promise<IOrder | null> {
        return Order.findByIdAndUpdate(
            orderId,
            { $set: { notes } },
            { new: true }
        );
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 13. Obtener orden por transactionId (consumido por webhooks)
    // ─────────────────────────────────────────────────────────────────────────
    async getOrderByTransactionId(transactionId: string): Promise<IOrder | null> {
        return Order.findOne({ 'payment.transactionId': transactionId });
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 14. Estado ligero de una orden por número comercial (polling de checkout)
    // ─────────────────────────────────────────────────────────────────────────
    async getOrderStatusByNumber(
        orderNumber: string
    ): Promise<Pick<IOrder, 'status' | 'payment'> | null> {
        return Order.findOne({ orderNumber })
            .select('status payment.status')
            .lean();
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 15. Estadísticas globales de órdenes (dashboard admin)
    // ─────────────────────────────────────────────────────────────────────────
    async getStats(from?: string, to?: string): Promise<OrderStats> {
        const dateFilter: FilterQuery<IOrder> = {};
        if (from || to) {
            dateFilter.createdAt = {};
            if (from) dateFilter.createdAt.$gte = new Date(from);
            if (to) {
                const endDate = new Date(to);
                endDate.setHours(23, 59, 59, 999);
                dateFilter.createdAt.$lte = endDate;
            }
        }

        const [statusAgg, paymentAgg, revenueAgg] = await Promise.all([
            Order.aggregate([
                { $match: dateFilter },
                { $group: { _id: '$status', count: { $sum: 1 } } },
            ]),
            Order.aggregate([
                { $match: { ...dateFilter, 'payment.status': { $exists: true } } },
                { $group: { _id: '$payment.status', count: { $sum: 1 } } },
            ]),
            Order.aggregate([
                {
                    $match: {
                        ...dateFilter,
                        'payment.status': PaymentStatus.APPROVED,
                    },
                },
                { $group: { _id: null, total: { $sum: '$totalPrice' } } },
            ]),
        ]);

        const byStatus = Object.fromEntries(
            statusAgg.map((s) => [s._id, s.count])
        );
        const byPaymentStatus = Object.fromEntries(
            paymentAgg.map((s) => [s._id, s.count])
        );
        const totalRevenue = revenueAgg[0]?.total || 0;

        return { totalOrders: statusAgg.reduce((sum, s) => sum + s.count, 0), totalRevenue, byStatus, byPaymentStatus };
    },
};