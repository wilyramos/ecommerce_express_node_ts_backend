// File: backend/src/modules/order/order.service.ts

import mongoose, { FilterQuery, Types, UpdateQuery } from 'mongoose';
import Order, { IOrder, IOrderItem, OrderStatus, PaymentStatus } from '../../models/Order';
import Product from '../../models/Product';
import { generateSecureOrderNumber } from '../../utils/orderNumber-helper';
import { OrderEmail } from '../../emails/OrderEmailResend';

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

// ── Servicio ──────────────────────────────────────────────────────────────────

export const orderService = {

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Crear orden (Inicializa en Espera de Pago, sin alterar stock ni enviar correo)
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

            const culqiOrderData = (await culqiResponse.json()) as { id?: string; object?: string;[key: string]: unknown };

            if (culqiResponse.ok && culqiOrderData.id) {
                culqiOrderId = culqiOrderData.id;
            }
        } catch (error) {
            console.error("❌ Error de red con Culqi Orders API:", error);
        }

        const estimatedDeliveryDate = new Date();
        estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + 3);

        return Order.create({
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
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Obtener orden por ObjectId
    // ─────────────────────────────────────────────────────────────────────────
    async getOrderById(orderId: string): Promise<IOrder | null> {
        return Order.findById(orderId).populate('user', 'nombre apellidos email').lean();
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Obtener orden por número comercial (ORD-...)
    // ─────────────────────────────────────────────────────────────────────────
    async getOrderByNumber(orderNumber: string): Promise<IOrder | null> {
        return Order.findOne({ orderNumber }).populate('user', 'nombre apellidos email').lean();
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Historial paginado de un usuario registrado
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
    // 5. Historial paginado de invitado por email
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
    // 6. Listado admin con filtros y rangos de fecha
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
    // 7. Actualizar estado logístico manual (Idempotente con control de stock fuera de línea)
    // ─────────────────────────────────────────────────────────────────────────
    async updateOrderStatus(orderId: string, newStatus: OrderStatus, actionBy?: string, reason?: string): Promise<IOrder | null> {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const order = await Order.findById(orderId).session(session);
            if (!order) {
                await session.abortTransaction();
                session.endSession();
                return null;
            }

            if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.CANCELED) {
                throw new Error(`Operación denegada. La orden ya está en un estado terminal: ${order.status}`);
            }

            // Evaluar si ya se procesó stock dinámico anteriormente
            const yaTeniaStockDescontado = order.statusHistory.some(
                (h) => h.status === OrderStatus.PROCESSING ||
                    h.status === OrderStatus.SHIPPED ||
                    h.status === OrderStatus.DELIVERED ||
                    h.status === OrderStatus.PAID_BUT_OUT_OF_STOCK
            );

            const nuevoEstadoRequiereStock =
                newStatus === OrderStatus.PROCESSING ||
                newStatus === OrderStatus.SHIPPED ||
                newStatus === OrderStatus.DELIVERED;

            // Descuento de stock en base de datos para flujos manuales de administración (Efectivo/Transferencia)
            if (nuevoEstadoRequiereStock && !yaTeniaStockDescontado) {
                for (const item of order.items) {
                    const productId = (item.productId as any)?._id ?? item.productId;

                    if (item.variantId) {
                        const prodData = await Product.findById(productId).session(session);
                        const variant = prodData?.variants?.find(v => v._id?.toString() === item.variantId?.toString());

                        if (!variant || variant.stock < item.quantity) {
                            throw new Error(`Stock insuficiente en almacén para la variante de: ${item.nombre}`);
                        }

                        await Product.updateOne(
                            { _id: productId, 'variants._id': item.variantId },
                            { $inc: { 'variants.$.stock': -item.quantity } }
                        ).session(session);

                        const updatedProd = await Product.findById(productId).session(session);
                        if (updatedProd && updatedProd.variants) {
                            updatedProd.stock = updatedProd.variants.reduce((sum, v) => sum + (v.stock ?? 0), 0);
                            await updatedProd.save({ session });
                        }
                    } else {
                        const prodData = await Product.findById(productId).session(session);
                        if (!prodData || (prodData.stock ?? 0) < item.quantity) {
                            throw new Error(`Stock insuficiente en almacén para el producto: ${item.nombre}`);
                        }

                        await Product.updateOne(
                            { _id: productId },
                            { $inc: { stock: -item.quantity } }
                        ).session(session);
                    }
                }

                // Forzar estado aprobado financiero por validación offline del administrador
                if (!order.payment) {
                    order.payment = {
                        provider: 'manual_admin',
                        method: 'offline_verificado',
                        status: PaymentStatus.APPROVED,
                        rawResponse: { aprobadoPor: actionBy, motivo: reason }
                    };
                } else {
                    order.payment.status = PaymentStatus.APPROVED;
                }
            }

            order.status = newStatus;
            order.statusHistory.push({
                status: newStatus,
                changedAt: new Date(),
                actionBy: actionBy ?? 'system',
                reason: reason ?? 'Cambio de estado administrativo'
            });

            await order.save({ session });
            await session.commitTransaction();
            session.endSession();

            OrderEmail.sendOrderStatusUpdateEmail({
                email: order.customerProfile.email,
                name: order.customerProfile.nombre,
                orderNumber: order.orderNumber,
                status: newStatus
            }).catch(err => console.error("Error enviando email de estado:", err));

            return order;
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 8. Asignar tracking de paquetería (Hereda la lógica de descuento si viene directo)
    // ─────────────────────────────────────────────────────────────────────────
    async assignTracking(orderId: string, trackingNumber: string, actionBy?: string): Promise<IOrder | null> {
        // Delega la actualización a updateOrderStatus para reutilizar de forma segura la lógica transaccional de stock
        return this.updateOrderStatus(
            orderId,
            OrderStatus.SHIPPED,
            actionBy,
            `Asignación automática de tracking por despacho de guía comercial: ${trackingNumber}`
        ).then(async (order) => {
            if (order) {
                // Actualización complementaria de la guía sin romper la sesión transaccional previa
                return Order.findByIdAndUpdate(orderId, { $set: { trackingNumber } }, { new: true });
            }
            return null;
        });
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 9. Actualizar estado de pago (Webhooks de Pasarelas)
    // ─────────────────────────────────────────────────────────────────────────
    async updatePayment(
        orderId: string,
        paymentData: { provider: string; method?: string; transactionId: string; status: PaymentStatus; rawResponse?: unknown }
    ): Promise<IOrder | null> {
        // Nota: El descuento físico de stock por webhooks automatizados ya ocurre de forma atómica dentro de culqi.webhook.ts
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
    // 10. Cancelación atómica con restitución condicional de stock
    // ─────────────────────────────────────────────────────────────────────────
    async cancelOrder(orderId: string, actionBy?: string, reason?: string): Promise<IOrder | null> {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const executor = actionBy ?? 'system_request';
            const cancelReasonStr = reason ?? 'Cancelación solicitada por el usuario o administración';

            const order = await Order.findOne({
                _id: orderId,
                status: { $nin: [OrderStatus.DELIVERED, OrderStatus.CANCELED] },
            }).session(session);

            if (!order) {
                throw new Error('La orden no se puede cancelar en su estado logístico actual o ya se encuentra cerrada.');
            }

            // Determinar de forma certera si la orden pasó por una etapa donde SE DESCONTÓ stock
            const teniaStockDescontado = order.statusHistory.some(
                (h) => h.status === OrderStatus.PROCESSING ||
                    h.status === OrderStatus.SHIPPED ||
                    h.status === OrderStatus.PAID_BUT_OUT_OF_STOCK
            );

            // Restituir stock únicamente si existió un descuento previo válido
            if (teniaStockDescontado) {
                for (const item of order.items) {
                    const productId = (item.productId as any)?._id ?? item.productId;
                    if (item.variantId) {
                        await Product.updateOne(
                            { _id: productId, 'variants._id': item.variantId },
                            { $inc: { 'variants.$.stock': item.quantity } }
                        ).session(session);

                        const updatedProd = await Product.findById(productId).session(session);
                        if (updatedProd && updatedProd.variants) {
                            updatedProd.stock = updatedProd.variants.reduce((sum, v) => sum + (v.stock ?? 0), 0);
                            await updatedProd.save({ session });
                        }
                    } else {
                        await Product.updateOne(
                            { _id: productId },
                            { $inc: { stock: item.quantity } }
                        ).session(session);
                    }
                }
            }

            // Persistencia física del estado terminal CANCELED
            order.status = OrderStatus.CANCELED;
            order.canceledAt = new Date();
            order.canceledBy = executor;
            order.cancelReason = cancelReasonStr;
            order.statusHistory.push({
                status: OrderStatus.CANCELED,
                changedAt: new Date(),
                actionBy: executor,
                reason: cancelReasonStr
            });

            await order.save({ session });
            await session.commitTransaction();
            session.endSession();

            OrderEmail.sendOrderStatusUpdateEmail({
                email: order.customerProfile.email,
                name: order.customerProfile.nombre,
                orderNumber: order.orderNumber,
                status: OrderStatus.CANCELED
            }).catch(err => console.error("Error enviando email de cancelación:", err));

            return order;
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 11. Reembolso con Transacción Atómica y Restitución de Stock
    // ─────────────────────────────────────────────────────────────────────────
    async refundOrder(orderId: string, actionBy?: string, reason?: string): Promise<IOrder | null> {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const order = await Order.findById(orderId).session(session);
            if (!order) {
                await session.abortTransaction();
                session.endSession();
                return null;
            }

            if (order.payment?.status !== PaymentStatus.APPROVED) {
                throw new Error('Solo se pueden reembolsar órdenes que tengan un pago previamente aprobado.');
            }

            if (order.status === OrderStatus.DELIVERED) {
                throw new Error('No se puede reembolsar automáticamente una orden ya entregada.');
            }

            if (order.status === OrderStatus.CANCELED) {
                throw new Error('La orden ya ha sido cancelada previamente.');
            }

            const executor = actionBy ?? 'admin_system';
            const refundReason = reason ?? 'Reembolso manual aprobado por administración';

            for (const item of order.items) {
                const productId = (item.productId as any)?._id ?? item.productId;
                if (item.variantId) {
                    await Product.updateOne(
                        { _id: productId, 'variants._id': item.variantId },
                        { $inc: { 'variants.$.stock': item.quantity } }
                    ).session(session);

                    const updatedProd = await Product.findById(productId).session(session);
                    if (updatedProd && updatedProd.variants) {
                        updatedProd.stock = updatedProd.variants.reduce((sum, v) => sum + (v.stock ?? 0), 0);
                        await updatedProd.save({ session });
                    }
                } else {
                    await Product.updateOne(
                        { _id: productId },
                        { $inc: { stock: item.quantity } }
                    ).session(session);
                }
            }

            order.status = OrderStatus.CANCELED;
            if (order.payment) order.payment.status = PaymentStatus.REFUNDED;
            order.canceledAt = new Date();
            order.canceledBy = executor;
            order.cancelReason = `Reembolso aprobado: ${refundReason}`;
            order.statusHistory.push({
                status: OrderStatus.CANCELED,
                changedAt: new Date(),
                actionBy: executor,
                reason: `Orden revertida por reembolso financiero. Motivo: ${refundReason}`
            });

            await order.save({ session });
            await session.commitTransaction();
            session.endSession();

            OrderEmail.sendOrderStatusUpdateEmail({
                email: order.customerProfile.email,
                name: order.customerProfile.nombre,
                orderNumber: order.orderNumber,
                status: OrderStatus.CANCELED
            }).catch(err => console.error("Error enviando email de reembolso:", err));

            return order;
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
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
    // 14. Estado ligero para polling de pasarela
    // ─────────────────────────────────────────────────────────────────────────
    async getOrderStatusByNumber(orderNumber: string): Promise<Pick<IOrder, 'status' | 'payment'> | null> {
        return Order.findOne({ orderNumber }).select('status payment.status').lean();
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 15. Estadísticas globales de órdenes
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