// File: backend/src/modules/order/order.service.ts

import { FilterQuery, Types, UpdateQuery } from 'mongoose';
import Order, { IOrder, IOrderItem, OrderStatus, PaymentStatus } from '../../models/Order';
import Product from '../../models/Product';
import { generateSecureOrderNumber } from '../../utils/orderNumber-helper';
import { OrderEmail } from '../../emails/OrderEmailResend';

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
    shippingMethod?: string;
    notes?: string;
    currency?: string;
    deviceInfo?: {
        ipAddress?: string;
        userAgent?: string;
    };
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
                    throw new Error(`La variante específica para "${dbProduct.nombre}" no existe.`);
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
                finalNombre = attrStrings ? `${dbProduct.nombre} (${attrStrings})` : dbProduct.nombre;
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

        const shippingCost = subtotal < 49 ? 10 : 0;
        const totalPrice = subtotal + shippingCost;
        const amountInCents = Math.round(totalPrice * 100);
        
        let culqiOrderId: string | undefined = undefined;

        try {
            const culqiResponse = await fetch("https://api.culqi.com/v2/orders", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.CULQI_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    amount: amountInCents,
                    currency_code: dto.currency ?? "PEN",
                    description: `Cargo por orden comercial ${orderNumber}`,
                    order_number: orderNumber,
                    expiration_date: Math.floor(Date.now() / 1000) + (24 * 60 * 60),
                    client_details: {
                        first_name: dto.customerProfile.nombre,
                        last_name: dto.customerProfile.apellidos,
                        email: dto.customerProfile.email,
                        phone_number: dto.customerProfile.telefono
                    },
                    confirm: false,
                })
            });

            const culqiOrderData = (await culqiResponse.json()) as { id?: string; object?: string; [key: string]: unknown };

            if (culqiResponse.ok && culqiOrderData.id) {
                culqiOrderId = culqiOrderData.id;
            }
        } catch (error) {
            console.error("❌ Error de red con Culqi Orders API:", error);
        }

        const estimatedDeliveryDate = new Date();
        estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + 3);

        const createdOrder = await Order.create({
            orderNumber,
            culqiOrderId,
            user: dto.userId ? new Types.ObjectId(dto.userId) : undefined,
            customerProfile: dto.customerProfile,
            items,
            subtotal,
            shippingCost,
            totalPrice,
            currency: dto.currency ?? 'PEN',
            shippingAddress: dto.shippingAddress,
            shippingMethod: dto.shippingMethod ?? 'Delivery Estándar',
            estimatedDeliveryDate,
            notes: dto.notes,
            status: OrderStatus.AWAITING_PAYMENT,
            statusHistory: [{ 
                status: OrderStatus.AWAITING_PAYMENT, 
                changedAt: new Date(),
                actionBy: dto.userId ?? 'system_guest',
                reason: 'Orden inicializada en checkout'
            }],
            deviceInfo: dto.deviceInfo
        });

        // Email Inicial de creación/recibo de pedido
        OrderEmail.sendOrderConfirmationEmail({
            email: createdOrder.customerProfile.email,
            name: createdOrder.customerProfile.nombre,
            orderId: createdOrder.orderNumber,
            totalPrice: createdOrder.totalPrice,
            shippingMethod: `${createdOrder.shippingAddress.direccion}, ${createdOrder.shippingAddress.distrito}`,
            items: createdOrder.items
        }).catch(err => console.error("Error email de confirmación:", err));

        return createdOrder;
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Obtener orden por ObjectId
    // ─────────────────────────────────────────────────────────────────────────
    async getOrderById(orderId: string): Promise<IOrder | null> {
        return Order.findById(orderId).populate('user', 'nombre apellidos email').lean();
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Obtener orden por número comercial
    // ─────────────────────────────────────────────────────────────────────────
    async getOrderByNumber(orderNumber: string): Promise<IOrder | null> {
        return Order.findOne({ orderNumber }).populate('user', 'nombre apellidos email').lean();
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Historial por usuario registrado
    // ─────────────────────────────────────────────────────────────────────────
    async getOrdersByUser(userId: string, page = 1, limit = 10): Promise<{ orders: IOrder[]; total: number }> {
        const skip = (page - 1) * limit;
        const query = { user: new Types.ObjectId(userId) };
        const [orders, total] = await Promise.all([
            Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            Order.countDocuments(query),
        ]);
        return { orders, total };
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Historial por email invitado
    // ─────────────────────────────────────────────────────────────────────────
    async getOrdersByEmail(email: string, page = 1, limit = 10): Promise<{ orders: IOrder[]; total: number }> {
        const skip = (page - 1) * limit;
        const query = { 'customerProfile.email': email.toLowerCase() };
        const [orders, total] = await Promise.all([
            Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            Order.countDocuments(query),
        ]);
        return { orders, total };
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 6. Listado admin global
    // ─────────────────────────────────────────────────────────────────────────
    async getAllOrders(filters: OrderFilters): Promise<{ orders: IOrder[]; total: number }> {
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
            Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('user', 'nombre apellidos email').lean(),
            Order.countDocuments(query),
        ]);

        return { orders, total };
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 7. Actualizar estado logístico manual
    // ─────────────────────────────────────────────────────────────────────────
    async updateOrderStatus(orderId: string, newStatus: OrderStatus, actionBy?: string, reason?: string): Promise<IOrder | null> {
        const order = await Order.findByIdAndUpdate(
            orderId,
            {
                status: newStatus,
                $push: { 
                    statusHistory: { 
                        status: newStatus, 
                        changedAt: new Date(),
                        actionBy: actionBy ?? 'system',
                        reason: reason ?? 'Cambio de estado administrativo'
                    } 
                },
            },
            { new: true }
        );

        if (order) {
            OrderEmail.sendOrderStatusUpdateEmail({
                email: order.customerProfile.email,
                name: order.customerProfile.nombre,
                orderNumber: order.orderNumber,
                status: newStatus
            }).catch(err => console.error("Error enviando email de estado:", err));
        }

        return order;
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 8. Asignar tracking de paquetería
    // ─────────────────────────────────────────────────────────────────────────
    async assignTracking(orderId: string, trackingNumber: string, actionBy?: string): Promise<IOrder | null> {
        const order = await Order.findByIdAndUpdate(
            orderId,
            {
                trackingNumber,
                status: OrderStatus.SHIPPED,
                $push: { 
                    statusHistory: { 
                        status: OrderStatus.SHIPPED, 
                        changedAt: new Date(),
                        actionBy: actionBy ?? 'system',
                        reason: `Asignación de número de guía tracking: ${trackingNumber}`
                    } 
                },
            },
            { new: true }
        );

        if (order) {
            OrderEmail.sendOrderStatusUpdateEmail({
                email: order.customerProfile.email,
                name: order.customerProfile.nombre,
                orderNumber: order.orderNumber,
                status: OrderStatus.SHIPPED,
                trackingNumber
            }).catch(err => console.error("Error enviando email de tracking:", err));
        }

        return order;
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 9. Actualizar estado de pago (Webhooks)
    // ─────────────────────────────────────────────────────────────────────────
    async updatePayment(orderId: string, paymentData: { provider: string; method?: string; transactionId: string; status: PaymentStatus; rawResponse?: unknown }): Promise<IOrder | null> {
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
                statusHistory: { 
                    status: newOrderStatus, 
                    changedAt: new Date(),
                    actionBy: `webhook_${paymentData.provider}`,
                    reason: `Confirmación automatizada de pago: ${paymentData.status}`
                },
            };
        }

        const order = await Order.findByIdAndUpdate(orderId, update, { new: true });

        if (order && newOrderStatus) {
            OrderEmail.sendOrderStatusUpdateEmail({
                email: order.customerProfile.email,
                name: order.customerProfile.nombre,
                orderNumber: order.orderNumber,
                status: newOrderStatus
            }).catch(err => console.error("Error enviando email por pago:", err));
        }

        return order;
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 10. Cancelación atómica con restitución de stock
    // ─────────────────────────────────────────────────────────────────────────
    async cancelOrder(orderId: string, actionBy?: string, reason?: string): Promise<IOrder | null> {
        const executor = actionBy ?? 'system_request';
        const cancelReasonStr = reason ?? 'Cancelación solicitada por el usuario o timeout de pago';

        const order = await Order.findOneAndUpdate(
            {
                _id: orderId,
                status: { $nin: [OrderStatus.DELIVERED, OrderStatus.CANCELED] },
            },
            {
                status: OrderStatus.CANCELED,
                canceledAt: new Date(),
                canceledBy: executor,
                cancelReason: cancelReasonStr,
                $push: { 
                    statusHistory: { 
                        status: OrderStatus.CANCELED, 
                        changedAt: new Date(),
                        actionBy: executor,
                        reason: cancelReasonStr
                    } 
                },
            },
            { new: true }
        );

        if (!order) {
            const exists = await Order.findById(orderId);
            if (!exists) return null;
            throw new Error('La orden no se puede cancelar en su estado logístico actual.');
        }

        const teniaStockDescontado = order.statusHistory.some(
            (h) => h.status === OrderStatus.PROCESSING || h.status === OrderStatus.PAID_BUT_OUT_OF_STOCK
        );

        if (teniaStockDescontado) {
            for (const item of order.items) {
                if (item.variantId) {
                    await Product.updateOne(
                        { _id: item.productId, 'variants._id': item.variantId },
                        { $inc: { 'variants.$.stock': item.quantity } }
                    );
                } else {
                    await Product.updateOne({ _id: item.productId }, { $inc: { stock: item.quantity } });
                }
            }
        }

        OrderEmail.sendOrderStatusUpdateEmail({
            email: order.customerProfile.email,
            name: order.customerProfile.nombre,
            orderNumber: order.orderNumber,
            status: OrderStatus.CANCELED
        }).catch(err => console.error("Error enviando email de cancelación:", err));

        return order;
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 11. Marcar orden como reembolsada
    // ─────────────────────────────────────────────────────────────────────────
    async refundOrder(orderId: string, actionBy?: string, reason?: string): Promise<IOrder | null> {
        const order = await Order.findById(orderId);
        if (!order) return null;

        if (order.payment?.status !== PaymentStatus.APPROVED) {
            throw new Error('Solo se pueden reembolsar órdenes con pago aprobado.');
        }

        if (order.status === OrderStatus.DELIVERED) {
            throw new Error('No se puede reembolsar una orden ya entregada desde este panel.');
        }

        const executor = actionBy ?? 'admin_system';
        const refundReason = reason ?? 'Reembolso manual aprobado por administración';

        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            {
                $set: { 'payment.status': PaymentStatus.REFUNDED },
                status: OrderStatus.CANCELED,
                canceledAt: new Date(),
                canceledBy: executor,
                cancelReason: `Reembolso: ${refundReason}`,
                $push: { 
                    statusHistory: { 
                        status: OrderStatus.CANCELED, 
                        changedAt: new Date(),
                        actionBy: executor,
                        reason: `Orden cancelada debido a reembolso financiero. Motivo: ${refundReason}`
                    } 
                },
            },
            { new: true }
        );

        if (updatedOrder) {
            OrderEmail.sendOrderStatusUpdateEmail({
                email: updatedOrder.customerProfile.email,
                name: updatedOrder.customerProfile.nombre,
                orderNumber: updatedOrder.orderNumber,
                status: OrderStatus.CANCELED
            }).catch(err => console.error("Error enviando email de reembolso:", err));
        }

        return updatedOrder;
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 12. Actualizar nota interna
    // ─────────────────────────────────────────────────────────────────────────
    async updateNote(orderId: string, notes: string): Promise<IOrder | null> {
        return Order.findByIdAndUpdate(orderId, { $set: { notes } }, { new: true });
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 13. Obtener por transactionId
    // ─────────────────────────────────────────────────────────────────────────
    async getOrderByTransactionId(transactionId: string): Promise<IOrder | null> {
        return Order.findOne({ 'payment.transactionId': transactionId });
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 14. Estado ligero para polling
    // ─────────────────────────────────────────────────────────────────────────
    async getOrderStatusByNumber(orderNumber: string): Promise<Pick<IOrder, 'status' | 'payment'> | null> {
        return Order.findOne({ orderNumber }).select('status payment.status').lean();
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 15. Estadísticas globales
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
            Order.aggregate([{ $match: dateFilter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
            Order.aggregate([{ $match: { ...dateFilter, 'payment.status': { $exists: true } } }, { $group: { _id: '$payment.status', count: { $sum: 1 } } }]),
            Order.aggregate([{ $match: { ...dateFilter, 'payment.status': PaymentStatus.APPROVED } }, { $group: { _id: null, total: { $sum: '$totalPrice' } } }]),
        ]);

        const byStatus = Object.fromEntries(statusAgg.map((s) => [s._id, s.count]));
        const byPaymentStatus = Object.fromEntries(paymentAgg.map((s) => [s._id, s.count]));
        const totalRevenue = revenueAgg[0]?.total || 0;

        return { totalOrders: statusAgg.reduce((sum, s) => sum + s.count, 0), totalRevenue, byStatus, byPaymentStatus };
    },
};