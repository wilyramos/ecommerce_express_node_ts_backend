// File: backend/src/modules/order/order.service.ts

import mongoose, { FilterQuery, Types, UpdateQuery } from 'mongoose';
import Order, { IOrder, IOrderItem, OrderStatus, PaymentStatus } from '../../models/Order';
import Product from '../../models/Product';
import { discountService, ICartItemValidation } from '../discount/discount.service';
import { generateSecureOrderNumber } from '../../utils/orderNumber-helper';
import { OrderEmail } from '../../emails/OrderEmailResend';
import { getPeruDateRange } from '../../utils/date-helper';
import { sendOrderToNubefact, sendCreditNoteToNubefact, sendVoidToNubefact } from '../../utils/nubefact';

// ── DTOs e Interfases ────────────────────────────────────────────────────────

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
    discountCode?: string;
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
    paidOrders: number;
    itemsDiscounted: number;
    paidRevenue: number;
    pendingFulfillment: number;
    salesReversals: number;
}

// ── Servicio Principal ─────────────────────────────────────────────────────────

export const orderService = {

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Crear Orden (Transaccional ACID + Culqi + Cupón Atómico por _id)
    // ─────────────────────────────────────────────────────────────────────────

    async createOrder(dto: CreateOrderDTO): Promise<IOrder> {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const orderNumber = generateSecureOrderNumber();
            const items: IOrderItem[] = [];
            let subtotal = 0;

            // 1.1. Recorrer e inspeccionar ítems del carrito
            for (const item of dto.items) {
                const dbProduct = await Product.findOne({
                    _id: item.productId,
                    isActive: true,
                    deletedAt: null,
                }).session(session).lean();

                if (!dbProduct) {
                    throw new Error(`Lo sentimos, uno de los productos de tu carrito ya no se encuentra disponible o fue descontinuado. Por favor, actualiza tu carrito.`);
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
                        throw new Error(`La opción seleccionada para el producto "${dbProduct.nombre}" ya no está disponible.`);
                    }
                    if (variant.stock < item.quantity) {
                        throw new Error(`Stock insuficiente. Solo nos quedan ${variant.stock} unidades disponibles de "${dbProduct.nombre}". Por favor, ajusta la cantidad.`);
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
                        throw new Error(`Stock insuficiente. Solo nos quedan ${dbProduct.stock} unidades disponibles de "${dbProduct.nombre}". Por favor, ajusta la cantidad.`);
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

            // 1.2. Costo de envío base
            let shippingCost = subtotal < 49 ? 10 : 0;

            // ── 1.3. Aplicar y Validar Descuento (Exclusividad: Manual O Automático) ──────
            let discountAmount = 0;
            let appliedCode: string | undefined = undefined;
            let appliedDiscountId: string | undefined = undefined;
            const customerIdentifier = dto.userId || dto.customerProfile.email.toLowerCase();

            const validationItems: ICartItemValidation[] = items.map((i) => ({
                productId: i.productId.toString(),
                variantId: i.variantId?.toString(),
                quantity: i.quantity,
                price: i.price,
            }));

            const cleanDiscountCode = dto.discountCode?.trim();
            const isAutomaticFromFrontend = cleanDiscountCode?.startsWith("AUTO-");

            if (cleanDiscountCode && !isAutomaticFromFrontend) {
                // A. Cupón Manual ingresado por el cliente
                const discountResult = await discountService.validateAndCalculateDiscount(
                    cleanDiscountCode,
                    subtotal,
                    validationItems,
                    customerIdentifier
                );

                discountAmount = discountResult.discountAmount;
                appliedCode = discountResult.code;
                appliedDiscountId = discountResult.id;

                if (discountResult.isFreeShipping) {
                    shippingCost = 0;
                }
            } else {
                // B. Evaluación de Promociones Automáticas (Si no hay cupón manual o vino un AUTO- de la UI)
                const autoEvaluation = await discountService.evaluateAutomaticDiscounts(
                    subtotal,
                    validationItems
                );

                if (autoEvaluation.appliedDiscount && autoEvaluation.discountAmount > 0) {
                    discountAmount = autoEvaluation.discountAmount;
                    appliedCode = `AUTO-${autoEvaluation.appliedDiscount.title}`;
                    appliedDiscountId = autoEvaluation.appliedDiscount.id;

                    if (autoEvaluation.appliedDiscount.type === 'FREE_SHIPPING') {
                        shippingCost = 0;
                    }
                }
            }

            // Consumir/Reservar el límite del descuento atómicamente en MongoDB por su _id
            if (appliedDiscountId) {
                await discountService.consumeCouponById(appliedDiscountId, customerIdentifier, session);
            }

            // 1.4. Cálculo total financiero
            const totalPrice = Math.max(0, subtotal + shippingCost - discountAmount);
            const amountInCents = Math.round(totalPrice * 100);

            let culqiOrderId: string | undefined = undefined;

            // 1.5. Comunicación con Culqi Orders API
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
                        description: `Orden de compra ${orderNumber}`,
                        order_number: orderNumber,
                        expiration_date: Math.floor(Date.now() / 1000) + (24 * 60 * 60),
                        client_details: {
                            first_name: dto.customerProfile.nombre,
                            last_name: dto.customerProfile.apellidos,
                            email: dto.customerProfile.email,
                            phone_number: dto.customerProfile.telefono
                        },
                        confirm: false,
                        metadata: {
                            orderNumber: orderNumber
                        }
                    })
                });

                const culqiOrderData = (await culqiResponse.json()) as { id?: string };
                if (culqiResponse.ok && culqiOrderData.id) {
                    culqiOrderId = culqiOrderData.id;
                }
            } catch (error) {
                console.error("❌ Error de comunicación con la API de Culqi:", error);
            }

            const estimatedDeliveryDate = new Date();
            estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + 3);

            // 1.6. Persistir la Orden en MongoDB
            const [order] = await Order.create([{
                orderNumber,
                culqiOrderId,
                user: dto.userId ? new Types.ObjectId(dto.userId) : undefined,
                customerProfile: dto.customerProfile,
                items,
                subtotal,
                shippingCost,
                discountId: appliedDiscountId ? new Types.ObjectId(appliedDiscountId) : undefined,
                discountCode: appliedCode,
                discountAmount,
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
                    reason: 'Orden inicializada en el checkout'
                }],
                deviceInfo: dto.deviceInfo
            }], { session });

            await session.commitTransaction();
            session.endSession();

            return order;

        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Consultas de Órdenes
    // ─────────────────────────────────────────────────────────────────────────

    async getOrderById(orderId: string): Promise<IOrder | null> {
        return Order.findById(orderId).populate('user', 'nombre apellidos email telefono').lean();
    },

    async getOrderByNumber(orderNumber: string): Promise<IOrder | null> {
        return Order.findOne({ orderNumber }).populate('user', 'nombre apellidos email telefono').lean();
    },

    async getOrdersByUser(userId: string, page = 1, limit = 10): Promise<{ orders: IOrder[]; total: number }> {
        const skip = (page - 1) * limit;
        const query = { user: new Types.ObjectId(userId) };
        const [orders, total] = await Promise.all([
            Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            Order.countDocuments(query),
        ]);
        return { orders, total };
    },

    async getOrdersByEmail(email: string, page = 1, limit = 10): Promise<{ orders: IOrder[]; total: number }> {
        const skip = (page - 1) * limit;
        const query = { 'customerProfile.email': email.toLowerCase() };
        const [orders, total] = await Promise.all([
            Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            Order.countDocuments(query),
        ]);
        return { orders, total };
    },

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
            query.createdAt = getPeruDateRange(from, to);
        }

        const [orders, total] = await Promise.all([
            Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('user', 'nombre apellidos email telefono').lean(),
            Order.countDocuments(query),
        ]);

        return { orders, total };
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Métricas y Analítica
    // ─────────────────────────────────────────────────────────────────────────

    async getStats(filters: { from?: string; to?: string } = {}): Promise<OrderStats> {
        const matchStage: FilterQuery<IOrder> = {};

        if (filters.from || filters.to) {
            matchStage.createdAt = getPeruDateRange(filters.from, filters.to);
        }

        const aggregation = await Order.aggregate([
            { $match: matchStage },
            {
                $project: {
                    status: 1,
                    totalPrice: 1,
                    paymentStatus: "$payment.status",
                    totalItems: { $sum: "$items.quantity" },
                    isPaid: {
                        $or: [
                            { $eq: ["$payment.status", PaymentStatus.APPROVED] },
                            { $in: ["$status", [OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.PAID_BUT_OUT_OF_STOCK]] }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    paidOrders: { $sum: { $cond: ["$isPaid", 1, 0] } },
                    itemsDiscounted: { $sum: { $cond: ["$isPaid", "$totalItems", 0] } },
                    paidRevenue: { $sum: { $cond: ["$isPaid", "$totalPrice", 0] } },
                    pendingFulfillment: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        "$isPaid",
                                        { $in: ["$status", [OrderStatus.PROCESSING, OrderStatus.PAID_BUT_OUT_OF_STOCK]] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    },
                    salesReversals: {
                        $sum: {
                            $cond: [{ $eq: ["$paymentStatus", PaymentStatus.REFUNDED] }, "$totalPrice", 0]
                        }
                    }
                }
            }
        ]);

        return aggregation[0] ? {
            paidOrders: aggregation[0].paidOrders || 0,
            itemsDiscounted: aggregation[0].itemsDiscounted || 0,
            paidRevenue: aggregation[0].paidRevenue || 0,
            pendingFulfillment: aggregation[0].pendingFulfillment || 0,
            salesReversals: aggregation[0].salesReversals || 0,
        } : {
            paidOrders: 0,
            itemsDiscounted: 0,
            paidRevenue: 0,
            pendingFulfillment: 0,
            salesReversals: 0,
        };
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Actualización de Estados Logísticos e Inventario
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
                throw new Error(`Operación denegada. La orden se encuentra en estado terminal: ${order.status}`);
            }

            // CORRECCIÓN CLAVE: PAID_BUT_OUT_OF_STOCK NO descuenta stock en la nueva lógica de deductStock
            const yaTeniaStockDescontado = order.statusHistory.some(
                (h) => h.status === OrderStatus.PROCESSING ||
                    h.status === OrderStatus.SHIPPED ||
                    h.status === OrderStatus.DELIVERED
            );

            const nuevoEstadoRequiereStock =
                newStatus === OrderStatus.PROCESSING ||
                newStatus === OrderStatus.SHIPPED ||
                newStatus === OrderStatus.DELIVERED;

            let fueAprobadoManualmenteAhora = false;

            if (nuevoEstadoRequiereStock && !yaTeniaStockDescontado) {
                for (const item of order.items) {
                    const productId = (item.productId as any)?._id ?? item.productId;

                    if (item.variantId) {
                        const prodData = await Product.findById(productId).session(session);
                        const variant = prodData?.variants?.find(v => v._id?.toString() === item.variantId?.toString());

                        if (!variant || variant.stock < item.quantity) {
                            throw new Error(`Stock insuficiente en almacén para la variante de: ${item.nombre}. Agregue stock primero.`);
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
                            throw new Error(`Stock insuficiente en almacén para el producto: ${item.nombre}. Agregue stock primero.`);
                        }

                        await Product.updateOne(
                            { _id: productId },
                            { $inc: { stock: -item.quantity } }
                        ).session(session);
                    }
                }

                if (!order.payment || order.payment.status !== PaymentStatus.APPROVED) {
                    order.payment = {
                        provider: 'manual_admin',
                        method: 'offline_verificado',
                        status: PaymentStatus.APPROVED,
                        rawResponse: { aprobadoPor: actionBy, motivo: reason }
                    };
                    fueAprobadoManualmenteAhora = true;
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

            const itemsList = order.items.map((item: any) => item.toObject());
            const shippingInfo = order.shippingAddress?.direccion ?? order.shippingMethod ?? 'Delivery';

            const emailPromises: Promise<any>[] = [
                OrderEmail.sendOrderStatusUpdateEmail({
                    email: order.customerProfile.email,
                    name: order.customerProfile.nombre,
                    orderNumber: order.orderNumber,
                    status: newStatus,
                    totalPrice: order.totalPrice,
                    items: itemsList,
                    trackingNumber: order.trackingNumber
                })
            ];

            if (fueAprobadoManualmenteAhora && newStatus === OrderStatus.PROCESSING) {
                emailPromises.push(
                    OrderEmail.sendAdminOrderNotificationEmail({
                        customerName: `${order.customerProfile.nombre} ${order.customerProfile.apellidos}`.trim(),
                        customerEmail: order.customerProfile.email,
                        customerPhone: order.customerProfile.telefono,
                        orderId: order.orderNumber,
                        totalPrice: order.totalPrice,
                        shippingMethod: shippingInfo,
                        items: itemsList
                    })
                );
            }

            Promise.allSettled(emailPromises).then((results) => {
                results.forEach((res, idx) => {
                    if (res.status === 'rejected') {
                        console.error(`⚠️ Fallo en envío de correo [${idx === 0 ? 'Cliente' : 'Admin'}]:`, res.reason);
                    }
                });
            });

            return order;
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    },

    async assignTracking(orderId: string, trackingNumber: string, actionBy?: string): Promise<IOrder | null> {
        await Order.findByIdAndUpdate(orderId, { $set: { trackingNumber } });

        return this.updateOrderStatus(
            orderId,
            OrderStatus.SHIPPED,
            actionBy,
            `Asignación de guía de despacho: ${trackingNumber}`
        );
    },

    async updatePayment(
        orderId: string,
        paymentData: { provider: string; method?: string; transactionId: string; status: PaymentStatus; rawResponse?: unknown }
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
            const itemsList = order.items.map((item: any) => item.toObject());

            OrderEmail.sendOrderStatusUpdateEmail({
                email: order.customerProfile.email,
                name: order.customerProfile.nombre,
                orderNumber: order.orderNumber,
                status: newOrderStatus,
                totalPrice: order.totalPrice,
                items: itemsList,
                trackingNumber: order.trackingNumber
            }).catch(err => console.error("Error enviando email por actualización de pago:", err));
        }

        return order;
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Cancelación y Reembolso (Restitución de Cupones por _id e Inventario)
    // ─────────────────────────────────────────────────────────────────────────

    async cancelOrder(orderId: string, actionBy?: string, reason?: string): Promise<IOrder | null> {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const executor = actionBy ?? 'system_request';
            const cancelReasonStr = reason ?? 'Cancelación solicitada por usuario o administración';

            const order = await Order.findOne({
                _id: orderId,
                status: { $nin: [OrderStatus.DELIVERED, OrderStatus.CANCELED] },
            }).session(session);

            if (!order) {
                throw new Error('La orden no se puede cancelar en su estado actual o ya está cerrada.');
            }

            // CORRECCIÓN: Evitar duplicar stock si la orden falló en PAID_BUT_OUT_OF_STOCK
            const teniaStockDescontado = order.statusHistory.some(
                (h) => h.status === OrderStatus.PROCESSING ||
                    h.status === OrderStatus.SHIPPED ||
                    h.status === OrderStatus.DELIVERED
            );

            // 5.1. Restituir inventario SOLO si realmente se descontó
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

            // 5.2. Restituir el límite de uso del cupón usando su _id de MongoDB
            if (order.discountId) {
                const customerId = order.user?.toString() || order.customerProfile.email.toLowerCase();
                await discountService.releaseCouponById(order.discountId.toString(), customerId, session);
            }

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

            const itemsList = order.items.map((item: any) => item.toObject());

            OrderEmail.sendOrderStatusUpdateEmail({
                email: order.customerProfile.email,
                name: order.customerProfile.nombre,
                orderNumber: order.orderNumber,
                status: OrderStatus.CANCELED,
                totalPrice: order.totalPrice,
                items: itemsList
            }).catch(err => console.error("Error enviando email de cancelación:", err));

            return order;
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    },

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
                throw new Error('Solo se pueden reembolsar órdenes con pago aprobado.');
            }

            if (order.status === OrderStatus.DELIVERED) {
                throw new Error('No se puede reembolsar automáticamente una orden entregada.');
            }

            if (order.status === OrderStatus.CANCELED) {
                throw new Error('La orden ya ha sido cancelada previamente.');
            }

            const executor = actionBy ?? 'admin_system';
            const refundReason = reason ?? 'Reembolso manual aprobado por administración';

            // CORRECCIÓN: Evitar duplicar stock si la orden se cobró pero no tenía stock
            const teniaStockDescontado = order.statusHistory.some(
                (h) => h.status === OrderStatus.PROCESSING ||
                    h.status === OrderStatus.SHIPPED ||
                    h.status === OrderStatus.DELIVERED
            );

            // Restitución de Stock SOLO si realmente fue descontado
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

            // Restitución de Cupón por _id
            if (order.discountId) {
                const customerId = order.user?.toString() || order.customerProfile.email.toLowerCase();
                await discountService.releaseCouponById(order.discountId.toString(), customerId, session);
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
                reason: `Orden revertida por reembolso. Motivo: ${refundReason}`
            });

            await order.save({ session });
            await session.commitTransaction();
            session.endSession();

            const itemsList = order.items.map((item: any) => item.toObject());

            OrderEmail.sendOrderStatusUpdateEmail({
                email: order.customerProfile.email,
                name: order.customerProfile.nombre,
                orderNumber: order.orderNumber,
                status: OrderStatus.CANCELED,
                totalPrice: order.totalPrice,
                items: itemsList
            }).catch(err => console.error("Error enviando email de reembolso:", err));

            return order;
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 6. Utilidades y Mantenimiento
    // ─────────────────────────────────────────────────────────────────────────

    async updateNote(orderId: string, notes: string): Promise<IOrder | null> {
        return Order.findByIdAndUpdate(orderId, { $set: { notes } }, { new: true });
    },

    async getOrderByTransactionId(transactionId: string): Promise<IOrder | null> {
        return Order.findOne({ 'payment.transactionId': transactionId });
    },

    async getOrderStatusByNumber(orderNumber: string): Promise<Pick<IOrder, 'status' | 'payment'> | null> {
        return Order.findOne({ orderNumber }).select('status payment.status').lean();
    },

    async cancelExpiredOrders(hoursThreshold = 24): Promise<{ canceledCount: number }> {
        const thresholdDate = new Date();
        thresholdDate.setHours(thresholdDate.getHours() - hoursThreshold);

        const expiredOrders = await Order.find({
            status: OrderStatus.AWAITING_PAYMENT,
            createdAt: { $lt: thresholdDate }
        }).select('_id orderNumber discountId user customerProfile');

        if (expiredOrders.length === 0) {
            return { canceledCount: 0 };
        }

        const expiredIds = expiredOrders.map(o => o._id);

        // Liberar cupones por _id de las órdenes expiradas por inactividad
        for (const expOrder of expiredOrders) {
            if (expOrder.discountId) {
                const customerId = expOrder.user?.toString() || expOrder.customerProfile.email.toLowerCase();
                await discountService.releaseCouponById(expOrder.discountId.toString(), customerId).catch(() => null);
            }
        }

        const result = await Order.updateMany(
            { _id: { $in: expiredIds } },
            {
                $set: {
                    status: OrderStatus.CANCELED,
                    canceledAt: new Date(),
                    canceledBy: 'system_auto_expiration',
                    cancelReason: `Expiración automática por superar la ventana de pago de ${hoursThreshold}h.`
                },
                $push: {
                    statusHistory: {
                        status: OrderStatus.CANCELED,
                        changedAt: new Date(),
                        actionBy: 'system_cron',
                        reason: `Cancelación automática por falta de pago.`
                    }
                }
            }
        );

        console.log(`🧹 [Cron Order Cleanup] Canceladas ${result.modifiedCount} órdenes vencidas.`);
        return { canceledCount: result.modifiedCount };
    },

    async getOrdersByIds(orderIds: string[]): Promise<IOrder[]> {
        return Order.find({ _id: { $in: orderIds } }).sort({ createdAt: -1 });
    },

    async resendOrderConfirmationEmail(orderId: string): Promise<{ success: boolean; message: string }> {
        const order = await Order.findById(orderId).lean();
        if (!order) {
            throw new Error('Orden no encontrada.');
        }

        const itemsList = order.items.map((item: any) => ({
            ...item,
            variantAttributes: item.variantAttributes instanceof Map
                ? Object.fromEntries(item.variantAttributes)
                : item.variantAttributes
        }));

        const addressParts = [
            order.shippingAddress?.direccion,
            order.shippingAddress?.numero ? `N° ${order.shippingAddress.numero}` : '',
            order.shippingAddress?.pisoDpto,
            `(${order.shippingAddress?.distrito}, ${order.shippingAddress?.provincia} - ${order.shippingAddress?.departamento})`
        ].filter(Boolean).join(' ');

        const result = await OrderEmail.sendOrderConfirmationEmail({
            email: order.customerProfile.email,
            name: `${order.customerProfile.nombre} ${order.customerProfile.apellidos}`.trim(),
            orderId: order.orderNumber,
            totalPrice: order.totalPrice,
            shippingMethod: addressParts || order.shippingMethod || 'Delivery Estándar',
            items: itemsList
        });

        if (!result.success) {
            throw new Error('No se pudo enviar el correo de confirmación. Verifica la configuración de correo.');
        }

        return { success: true, message: 'Correo de confirmación reenviado con éxito.' };
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 7. Facturación Electrónica SUNAT (Nubefact)
    // ─────────────────────────────────────────────────────────────────────────

    async generateBoleta(orderId: string, actionBy?: string): Promise<IOrder> {
        const order = await Order.findById(orderId);
        if (!order) throw new Error('Orden no encontrada.');

        if (order.invoice?.numero) {
            throw new Error(`La orden ya cuenta con la Boleta ${order.invoice.serie}-${order.invoice.numero} emitida.`);
        }

        const nubefactRes = await sendOrderToNubefact(order);

        order.invoice = {
            tipo: 'boleta',
            serie: nubefactRes.serie,
            numero: Number(nubefactRes.numero),
            pdfUrl: nubefactRes.enlace_del_pdf || `${nubefactRes.enlace}.pdf`,
            xmlUrl: nubefactRes.enlace_del_xml || `${nubefactRes.enlace}.xml`,
            cdrUrl: nubefactRes.enlace_del_cdr || `${nubefactRes.enlace}.cdr`,
            nubefactEnlace: nubefactRes.enlace,
            sunatResponseCode: String(nubefactRes.sunat_responsecode ?? ''),
            sunatDescription: nubefactRes.sunat_description || 'Aceptado por SUNAT',
            generatedAt: new Date()
        };

        order.statusHistory.push({
            status: order.status,
            changedAt: new Date(),
            actionBy: actionBy ?? 'admin',
            reason: `Emisión de Boleta Electrónica (${nubefactRes.serie}-${nubefactRes.numero})`
        });

        await order.save();
        return order;
    },

    async generateCreditNote(orderId: string, reason: string, actionBy?: string): Promise<IOrder> {
        const order = await Order.findById(orderId);
        if (!order) throw new Error('Orden no encontrada.');

        if (order.creditNote?.numero) {
            throw new Error(`Nota de crédito previamente emitida: ${order.creditNote.serie}-${order.creditNote.numero}`);
        }

        const ncRes = await sendCreditNoteToNubefact(order, reason);

        order.creditNote = {
            tipo: 'nota_credito',
            serie: ncRes.serie!,
            numero: Number(ncRes.numero),
            pdfUrl: ncRes.enlace_del_pdf || `${ncRes.enlace}.pdf`,
            xmlUrl: ncRes.enlace_del_xml || `${ncRes.enlace}.xml`,
            cdrUrl: ncRes.enlace_del_cdr || `${ncRes.enlace}.cdr`,
            nubefactEnlace: ncRes.enlace,
            sunatResponseCode: String(ncRes.sunat_responsecode ?? ''),
            sunatDescription: ncRes.sunat_description || 'Nota de crédito aceptada por SUNAT',
            generatedAt: new Date()
        };

        order.statusHistory.push({
            status: order.status,
            changedAt: new Date(),
            actionBy: actionBy ?? 'admin',
            reason: `Emisión de Nota de Crédito (${ncRes.serie}-${ncRes.numero})`
        });

        await order.save();
        return order;
    },

    async generateVoid(orderId: string, motivo: string, actionBy?: string): Promise<IOrder> {
        const order = await Order.findById(orderId);
        if (!order) throw new Error('Orden no encontrada.');

        if (order.voidInfo?.numero) {
            throw new Error('La anulación mediante Comunicación de Baja ya fue procesada.');
        }

        const voidRes = await sendVoidToNubefact(order, motivo);

        order.voidInfo = {
            tipo: 'anulacion',
            serie: order.invoice?.serie || 'BBB1',
            numero: order.invoice?.numero || 0,
            pdfUrl: voidRes.enlace_del_pdf || null,
            xmlUrl: voidRes.enlace_del_xml || null,
            cdrUrl: voidRes.enlace_del_cdr || null,
            nubefactEnlace: voidRes.enlace || null,
            sunatTicketNumero: voidRes.sunat_ticket_numero || null,
            sunatDescription: voidRes.sunat_description || 'Comunicación de baja enviada a SUNAT',
            generatedAt: new Date()
        };

        order.statusHistory.push({
            status: order.status,
            changedAt: new Date(),
            actionBy: actionBy ?? 'admin',
            reason: `Comunicación de Baja enviada a SUNAT. Motivo: ${motivo}`
        });

        await order.save();
        return order;
    }
};