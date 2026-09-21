// File: backend/src/modules/order-v3/order.service.ts
import { IOrderRepository } from './repositories/order.repository.interface';
import { IPaymentProvider } from '../../providers/payment/payment.provider.interface';
import Product from '../../models/Product';
import { IOrder, OrderStatus, PaymentStatus } from '../../models/Order';
import { AppError } from '../../utils/AppError';
import { CreateOrderInput, OrderFiltersQuery } from './order.schema';



class Culqi3DSRequired extends AppError {
    culqiStatus: number = 200;
    needs3DS: boolean = true;
    totalAmount: number;
    email: string;
 
    constructor(message: string, totalAmount: number, email: string) {
        super(message, 200);
        this.culqiStatus = 200;
        this.needs3DS = true;
        this.totalAmount = totalAmount;
        this.email = email;
    }
}

export class OrderService {
    constructor(
        private readonly orderRepository: IOrderRepository,
        private readonly paymentProvider: IPaymentProvider
    ) {}

    /**
     * ✅ 1. INICIALIZAR CHECKOUT (Crea orden local + orden en Culqi)
     */
    async initializeCheckout(
        data: CreateOrderInput,
        userId?: string,
        ipAddress?: string,
        userAgent?: string
    ): Promise<IOrder & { culqiAmountInCents?: number }> {
        let subtotal = 0;
        const populatedItems = [];

        console.log('[OrderService] 🔄 Inicializando checkout...', {
            itemsCount: data.items.length,
            currency: data.currency
        });

        // ✅ PASO 1: Validar existencias y precios reales en BD
        for (const item of data.items) {
            const product = await Product.findOne({ _id: item.productId, deletedAt: null }).lean();
            if (!product) {
                throw new AppError(`Producto no disponible: ${item.productId}`, 404);
            }

            let price = (product as any).precio || 0;
            let stock = (product as any).stock || 0;
            let itemAttributes: Record<string, string> | undefined = undefined;

            // Validar variante si existe
            if (item.variantId && Array.isArray((product as any).variants)) {
                const variant = (product as any).variants.find(
                    (v: any) => v._id.toString() === item.variantId
                );
                if (!variant) {
                    throw new AppError(`Variante ${item.variantId} no encontrada para ${product.nombre}`, 404);
                }
                price = variant.precio ?? price;
                stock = variant.stock ?? stock;
                itemAttributes = variant.atributos;
            }

            if (stock < item.quantity) {
                throw new AppError(
                    `Stock insuficiente para "${(product as any).nombre}". Disponible: ${stock}`,
                    400
                );
            }

            subtotal += price * item.quantity;
            populatedItems.push({
                productId: product._id,
                variantId: item.variantId ? (item.variantId as any) : undefined,
                variantAttributes: itemAttributes,
                quantity: item.quantity,
                price,
                nombre: (product as any).nombre,
                imagen: (product as any).imagenes?.[0] || '',
                sku: (product as any).sku,
                barcode: (product as any).barcode
            });
        }

        // ✅ PASO 2: Calcular costos
        const shippingCost = subtotal >= 49 ? 0 : 10;
        const discountAmount = 0; // Implementar validación de cupón aquí si existe
        const totalPrice = Math.max(0, subtotal + shippingCost - discountAmount);
        const culqiAmountInCents = Math.round(totalPrice * 100);
        const orderNumber = `${Date.now().toString().slice(-6)}${Math.floor(1000 + Math.random() * 9000)}`;

        console.log('[OrderService] 💰 Resumen de costos:', {
            subtotal,
            shippingCost,
            discountAmount,
            totalPrice,
            culqiAmountInCents,
            orderNumber
        });

        // ✅ PASO 3: Crear orden local en estado pendiente
        const newOrder = await this.orderRepository.create({
            orderNumber,
            user: userId ? (userId as any) : undefined,
            customerProfile: data.customerProfile,
            items: populatedItems as any,
            subtotal,
            shippingCost,
            discountCode: data.discountCode,
            discountAmount,
            totalPrice,
            currency: data.currency || 'PEN',
            shippingAddress: data.shippingAddress,
            shippingMethod: data.shippingMethod,
            notes: data.notes,
            status: OrderStatus.AWAITING_PAYMENT,
            statusHistory: [{
                status: OrderStatus.AWAITING_PAYMENT,
                changedAt: new Date(),
                reason: 'Orden creada pendiente de pago en Culqi'
            }],
            payment: {
                provider: 'culqi',
                status: PaymentStatus.PENDING
            },
            deviceInfo: { ipAddress, userAgent }
        });

        console.log('[OrderService] ✅ Orden local creada:', newOrder._id);

        try {
            // ✅ PASO 4: Preparar datos para Culqi
            // IMPORTANTE: Culqi requiere EXACTAMENTE estos datos sin espacios ni caracteres especiales
            
            const firstName = data.customerProfile.nombre.trim().substring(0, 50);
            const lastName = data.customerProfile.apellidos.trim().substring(0, 50);
            const email = data.customerProfile.email.trim().toLowerCase();
            // Limpiar teléfono: solo dígitos, máximo 15 caracteres, mínimo 9
            const phoneNumber = data.customerProfile.telefono
                .replace(/\D/g, '') // Solo dígitos
                .substring(0, 15) // Máximo 15 caracteres
                || '999999999'; // Fallback si está vacío

            // IMPORTANTE: Timestamp UNIX en SEGUNDOS, no milisegundos
            // Margen de 48 horas (2 días) para absorber desfases de reloj
            const expirationDate = Math.floor(Date.now() / 1000) + (48 * 60 * 60);

            // Validar que el monto sea >= 100 céntimos
            if (culqiAmountInCents < 100) {
                throw new AppError(
                    `Monto demasiado bajo (${culqiAmountInCents} céntimos). Mínimo: 100 céntimos (S/ 1.00)`,
                    400
                );
            }

            const culqiPayload = {
                // REQUERIDOS
                amount: culqiAmountInCents, // Número entero en céntimos
                currency_code: newOrder.currency, // "PEN" o "USD"
                description: `Orden ${orderNumber}`.substring(0, 80), // Máx 80 caracteres
                order_number: orderNumber, // Identificador único
                
                // Cliente (REQUERIDO)
                client_details: {
                    first_name: firstName,
                    last_name: lastName,
                    email: email,
                    phone_number: phoneNumber
                },
                
                // IMPORTANTE: Para órdenes asincrónicas (CIP/QR), NO incluir confirm:true
                // El frontend decidirá qué métodos de pago habilitar
                expiration_date: expirationDate,
                confirm: false // Esto permite órdenes CIP, Billetera, etc.
            };

            console.log('[OrderService] 📨 Enviando a Culqi:', {
                amount: culqiPayload.amount,
                currency_code: culqiPayload.currency_code,
                order_number: culqiPayload.order_number,
                email: culqiPayload.client_details.email,
                phone: `+51${culqiPayload.client_details.phone_number}`,
                expiration_date: new Date(culqiPayload.expiration_date * 1000).toISOString()
            });

            // ✅ PASO 5: Crear orden en Culqi
            const culqiOrder = await this.paymentProvider.createOrder(culqiPayload);

            console.log('[OrderService] ✅ Orden Culqi creada:', culqiOrder.id);

            // ✅ PASO 6: Guardar ID de Culqi en orden local
            const updatedOrder = await this.orderRepository.update(newOrder.id, {
                culqiOrderId: culqiOrder.id
            });

            const orderResponse = updatedOrder?.toObject ? updatedOrder.toObject() : updatedOrder;
            return { ...orderResponse, culqiAmountInCents } as any;

        } catch (error: any) {
            console.error('[OrderService] ❌ Error al crear orden en Culqi:', error);

            // Marcar orden como cancelada si Culqi falla
            await this.orderRepository.update(newOrder.id, {
                status: OrderStatus.CANCELED,
                cancelReason: `Fallo al generar orden en Culqi: ${error.message}`
            });

            throw error;
        }
    }

    /**
     * ✅ 2. PROCESAR CARGO DIRECTO (Tarjetas / Yape)
     */


    
async processCharge(
    orderId: string,
    tokenId: string,
    deviceFingerPrintId: string, // <-- Agregado
    authentication_3DS?: {
        xid: string;
        cavv: string;
        eci: string;
        protocolVersion: string;
        directoryServerTransactionId?: string;
    }
): Promise<IOrder> {
    console.log('[OrderService] 💳 Procesando cargo...', {
        orderId,
        tokenId: tokenId?.substring(0, 10) + '...',
        deviceFingerPrintId,
        has3DS: !!authentication_3DS,
        attempt: authentication_3DS ? 'second (with 3DS)' : 'first (trying without 3DS)'
    });
 
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new AppError('Orden no encontrada', 404);
 
    if (order.status !== OrderStatus.AWAITING_PAYMENT) {
        throw new AppError('La orden ya no se encuentra en espera de pago', 400);
    }
 
    try {
        // Preparar datos para Culqi
        const firstName = order.customerProfile.nombre.trim().substring(0, 50);
        const lastName = order.customerProfile.apellidos.trim().substring(0, 50);
        const email = order.customerProfile.email.trim().toLowerCase();
        const phoneNumber = order.customerProfile.telefono
            .replace(/\D/g, '')
            .substring(0, 15)
            || '999999999';
 
        // PAYLOAD BASE
       const chargePayload: any = {
            // REQUERIDOS
            amount: Math.round(order.totalPrice * 100), // En céntimos
            currency_code: order.currency,
            email: email,
            source_id: tokenId, // Token del modal de Culqi
            
            // Detalles de antifraude (RECOMENDADO)
            antifraude_details: {
                first_name: firstName,
                last_name: lastName,
                phone_number: phoneNumber,
                address: order.shippingAddress.direccion.trim().substring(0, 100),
                address_city: order.shippingAddress.distrito.trim().substring(0, 50),
                country_code: 'PE',
                device_finger_print_id: deviceFingerPrintId // Utiliza el valor recibido
            }
        };
 
        // 🔑 AGREGAR PARÁMETROS 3DS SI EXISTEN
        if (authentication_3DS) {
            console.log('[OrderService] 🔐 Agregando parámetros 3DS al cargo...');
            chargePayload.authentication_3DS = {
                xid: authentication_3DS.xid,
                cavv: authentication_3DS.cavv,
                eci: authentication_3DS.eci,
                protocolVersion: authentication_3DS.protocolVersion,
                directoryServerTransactionId: authentication_3DS.directoryServerTransactionId
            };
            console.log('[OrderService] 📨 Parámetros 3DS agregados:', {
                xid: authentication_3DS.xid.substring(0, 10) + '...',
                eci: authentication_3DS.eci,
                protocolVersion: authentication_3DS.protocolVersion
            });
        }
 
        console.log('[OrderService] 📨 Enviando cargo a Culqi:', {
            amount: chargePayload.amount,
            email: chargePayload.email,
            source_id: chargePayload.source_id.substring(0, 10) + '...',
            has3DSParams: !!authentication_3DS
        });
 
        // Procesar cargo en Culqi
        const charge = await this.paymentProvider.createCharge(chargePayload);
 
        console.log('[OrderService] ✅ Cargo aprobado:', charge.id);
 
        // Descontar inventario de forma atómica
        for (const item of order.items) {
            if (item.variantId) {
                await Product.updateOne(
                    { _id: item.productId, 'variants._id': item.variantId },
                    { $inc: { 'variants.$.stock': -item.quantity, stock: -item.quantity } }
                );
            } else {
                await Product.updateOne(
                    { _id: item.productId },
                    { $inc: { stock: -item.quantity } }
                );
            }
        }
 
        const updatedHistory = [
            ...order.statusHistory,
            {
                status: OrderStatus.PROCESSING,
                changedAt: new Date(),
                reason: `Pago aprobado vía Culqi ${authentication_3DS ? '(con autenticación 3DS)' : '(sin 3DS)'} (${charge.source?.type || 'tarjeta'})`
            }
        ];
 
        const updatedOrder = await this.orderRepository.update(order.id, {
            status: OrderStatus.PROCESSING,
            statusHistory: updatedHistory,
            payment: {
                provider: 'culqi',
                method: charge.source?.type || 'card',
                status: PaymentStatus.APPROVED,
                transactionId: charge.id,
                authentication3DS: authentication_3DS || null,
                rawResponse: charge
            }
        });
 
        return updatedOrder!;
 
    } catch (error: any) {
        console.error('[OrderService] ❌ Error al procesar cargo:', {
            message: error.message,
            status: error.status || error.culqiStatus,
            is3DS: error.is3DS,
            errorCode: error.code
        });
 
        // 🔑 DETECTAR CUANDO CULQI REQUIERE 3DS
        // Culqi devuelve status 200 con action_code = 'CHALLENGE' cuando 3DS es necesario
        if (
            error.is3DS === true || 
            (error.culqiStatus === 200 && error.needs3DS === true) ||
            (error.status === 200 && error.message?.toLowerCase().includes('3ds'))
        ) {
            console.log('[OrderService] 🔐 Culqi requiere 3DS para esta transacción');
            
            // ✅ LANZAR EXCEPCIÓN ESPECIAL QUE EL CONTROLLER CAPTURA
            const culqi3DSError = new Culqi3DSRequired(
                'Culqi 3DS Authentication Required',
                Math.round(order.totalPrice * 100), // Monto en céntimos
                order.customerProfile.email
            );
            throw culqi3DSError;
        }
 
        // ❌ Error normal (declination, invalid card, etc)
        const updatedHistory = [
            ...order.statusHistory,
            {
                status: OrderStatus.AWAITING_PAYMENT,
                changedAt: new Date(),
                reason: `Intento de cobro declinado: ${error.message}`
            }
        ];
 
        await this.orderRepository.update(order.id, {
            statusHistory: updatedHistory,
            payment: {
                provider: 'culqi',
                status: PaymentStatus.REJECTED,
                rawResponse: error.message
            }
        });
 
        throw error;
    }
}
    /**
     * ✅ 3. WEBHOOK HANDLER (PagoEfectivo / Billeteras / Confirmación diferida)
     */
    async handleWebhook(event: { type: string; data: any }): Promise<void> {
        const { type, data } = event;

        console.log('[OrderService] 🔔 Webhook recibido:', { type });

        if (type === 'order.status.changed') {
            const rawOrderData = typeof data === 'string' ? JSON.parse(data) : data;

            console.log('[OrderService] 📦 Estado de orden cambiado:', {
                state: rawOrderData.state,
                order_number: rawOrderData.order_number
            });

            if (rawOrderData.state === 'paid') {
                const orderNumber = rawOrderData.order_number;
                const order = await this.orderRepository.findByOrderNumber(orderNumber);

                if (order && order.status === OrderStatus.AWAITING_PAYMENT) {
                    console.log('[OrderService] ✅ Orden pagada vía webhook. Descontando stock...');

                    // Descontar inventario
                    for (const item of order.items) {
                        if (item.variantId) {
                            await Product.updateOne(
                                { _id: item.productId, 'variants._id': item.variantId },
                                { $inc: { 'variants.$.stock': -item.quantity, stock: -item.quantity } }
                            );
                        } else {
                            await Product.updateOne(
                                { _id: item.productId },
                                { $inc: { stock: -item.quantity } }
                            );
                        }
                    }

                    const updatedHistory = [
                        ...order.statusHistory,
                        {
                            status: OrderStatus.PROCESSING,
                            changedAt: new Date(),
                            reason: `Pago confirmado vía webhook (${rawOrderData.payment_code ? 'PagoEfectivo' : 'Billetera/Yape'})`
                        }
                    ];

                    await this.orderRepository.update(order.id, {
                        status: OrderStatus.PROCESSING,
                        statusHistory: updatedHistory,
                        payment: {
                            provider: 'culqi',
                            method: rawOrderData.payment_code ? 'pagoefectivo' : 'billetera',
                            status: PaymentStatus.APPROVED,
                            transactionId: rawOrderData.id,
                            rawResponse: rawOrderData
                        }
                    });

                    console.log('[OrderService] ✅ Webhook procesado exitosamente');
                }
            }
        }
    }

    /**
     * ✅ 4. CONSULTAS Y ADMINISTRACIÓN
     */
    async getOrderById(id: string): Promise<IOrder> {
        const order = await this.orderRepository.findById(id);
        if (!order) throw new AppError('Orden no encontrada', 404);
        return order;
    }

    async getOrderByNumber(orderNumber: string): Promise<IOrder> {
        const order = await this.orderRepository.findByOrderNumber(orderNumber);
        if (!order) throw new AppError('Orden no encontrada', 404);
        return order;
    }

    async getPaginatedOrders(queryFilters?: OrderFiltersQuery & { user?: string }) {
        const page = queryFilters?.page || 1;
        const limit = queryFilters?.limit || 10;
        const skip = (page - 1) * limit;

        const filters = {
            status: queryFilters?.status,
            email: queryFilters?.email,
            orderNumber: queryFilters?.orderNumber,
            user: queryFilters?.user
        };

        const result = await this.orderRepository.findPaginated(skip, limit, filters);
        return { ...result, page, limit };
    }

    async updateOrderStatus(
        id: string,
        newStatus: OrderStatus,
        reason?: string,
        adminId?: string
    ): Promise<IOrder> {
        const order = await this.orderRepository.findById(id);
        if (!order) throw new AppError('Orden no encontrada', 404);

        if (order.status === newStatus) return order;

        const updateData: Partial<IOrder> = {
            status: newStatus,
            statusHistory: [
                ...order.statusHistory,
                {
                    status: newStatus,
                    changedAt: new Date(),
                    actionBy: adminId,
                    reason: reason || `Estado cambiado manualmente a ${newStatus}`
                }
            ]
        };

        if (newStatus === OrderStatus.CANCELED) {
            updateData.canceledAt = new Date();
            updateData.canceledBy = adminId;
            updateData.cancelReason = reason;

            // Devolver stock si la orden fue cancelada después de procesar
            if (order.status !== OrderStatus.AWAITING_PAYMENT) {
                for (const item of order.items) {
                    if (item.variantId) {
                        await Product.updateOne(
                            { _id: item.productId, 'variants._id': item.variantId },
                            { $inc: { 'variants.$.stock': item.quantity, stock: item.quantity } }
                        );
                    } else {
                        await Product.updateOne(
                            { _id: item.productId },
                            { $inc: { stock: item.quantity } }
                        );
                    }
                }
            }
        }

        const updatedOrder = await this.orderRepository.update(id, updateData);
        return updatedOrder!;
    }
}