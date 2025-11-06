import Order, { OrderStatus, PaymentStatus } from '../models/Order';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product';
import { startOfDay, endOfDay, parseISO } from 'date-fns';



export class OrderController {

    static async createOrder(req: Request, res: Response) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const {
                items,
                subtotal,
                shippingCost,
                totalPrice,
                shippingAddress,
                paymentMethod,
                transactionId,
                payment,
                rawPaymentResponse,
                currency = 'PEN'
            } = req.body;

            if (!items || !Array.isArray(items) || items.length === 0) {
                res.status(400).json({ message: 'La orden debe tener al menos un producto' });
                return;
            }

            if (!payment?.provider) {
                res.status(400).json({ message: 'Proveedor de pago requerido' });
                return;
            }

            // Obtener productos desde DB
            const productIds = items.map(i => i.productId);
            const dbProducts = await Product.find({ _id: { $in: productIds } }).session(session);

            if (dbProducts.length !== items.length) {
                res.status(400).json({ message: 'Uno o más productos no existen' });
                return;
            }

            let calculatedSubtotal = 0;
            const orderItems: any[] = [];

            for (const item of items) {
                const dbProduct = dbProducts.find(p => p._id.toString() === item.productId);
                if (!dbProduct) continue;

                let finalPrice = dbProduct.precio || 0;
                let nombre = dbProduct.nombre;
                let imagen: string | undefined;
                let variantAttributes: Record<string, string> = {};

                // Si es variante
                if (item.variantId) {
                    const variant = dbProduct.variants?.find(v => v._id.toString() === item.variantId);
                    if (!variant) {
                        res.status(400).json({
                            message: `La variante seleccionada para "${dbProduct.nombre}" no existe`
                        });
                        return;
                    }

                    finalPrice = variant.precio ?? dbProduct.precio ?? 0;
                    nombre = `${dbProduct.nombre} ${variant.nombre ?? ''}`;
                    imagen = variant.imagenes?.[0] || dbProduct.imagenes?.[0];

                    // Conversión segura de atributos
                    if (variant.atributos instanceof Map) {
                        variantAttributes = Object.fromEntries(variant.atributos.entries());
                    } else if (variant.atributos && typeof variant.atributos === 'object') {
                        variantAttributes = { ...variant.atributos };
                    } else {
                        variantAttributes = {};
                    }

                    // Validar stock de la variante
                    if ((variant.stock ?? 0) < item.quantity) {
                        res.status(400).json({
                            message: `No hay suficiente stock para "${nombre}". Disponible: ${variant.stock}`
                        });
                        return;
                    }

                } else {
                    // Producto simple
                    imagen = dbProduct.imagenes?.[0];

                    // Validar stock del producto simple
                    if ((dbProduct.stock ?? 0) < item.quantity) {
                        res.status(400).json({
                            message: `No hay suficiente stock para "${nombre}". Disponible: ${dbProduct.stock}`
                        });
                        return;
                    }
                }

                // Validar precio enviado por frontend
                if (item.price !== finalPrice) {
                    res.status(400).json({
                        message: `El precio del producto "${nombre}" ha cambiado`
                    });
                    return;
                }

                calculatedSubtotal += finalPrice * item.quantity;

                orderItems.push({
                    productId: dbProduct._id,
                    variantId: item.variantId,
                    variantAttributes,
                    quantity: item.quantity,
                    price: finalPrice,
                    nombre,
                    imagen
                });
            }

            // Validar subtotal y total
            if (calculatedSubtotal !== subtotal) {
                res.status(400).json({ message: 'El subtotal no coincide' });
                return;
            }

            if (subtotal + shippingCost !== totalPrice) {
                res.status(400).json({ message: 'El total no coincide' });
                return;
            }

            // Generar número de orden único
            const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

            const newOrder = await Order.create([{
                orderNumber,
                user: req.user._id,
                items: orderItems,
                subtotal,
                shippingCost,
                totalPrice,
                currency,
                status: OrderStatus.AWAITING_PAYMENT,
                statusHistory: [{
                    status: OrderStatus.AWAITING_PAYMENT,
                    changedAt: new Date()
                }],
                shippingAddress,
                payment: {
                    provider: payment.provider,
                    method: paymentMethod,
                    transactionId,
                    status: payment.status || PaymentStatus.PENDING,
                    rawResponse: rawPaymentResponse
                }
            }], { session });

            await session.commitTransaction();

            res.status(201).json({
                message: 'Orden creada exitosamente',
                order: newOrder[0]
            });
            return;

        } catch (error) {
            await session.abortTransaction();
            console.error('Error al crear la orden:', error);
            res.status(500).json({ message: 'Error al crear la orden' });
            return;
        } finally {
            session.endSession();
        }
    }


    // Trear todas las orders para el administrador
    static async getOrders(req: Request, res: Response) {
        try {

            // TODO: query
            const page = parseInt(req.query.page as string) || 1;
            let limit = parseInt(req.query.limit as string) || 10;
            const pedido = req.query.pedido as string || '';
            const fecha = req.query.fecha as string || '';
            const estadoPago = req.query.estadoPago as string || '';
            const estadoEnvio = req.query.estadoEnvio as string || '';

            console.log({ page, limit, pedido, fecha, estadoPago, estadoEnvio });

            if (limit > 50) {
                limit = 50; // Limitar a un máximo de 50
            }
            const skip = (page - 1) * limit;
            const searchConditions: any = {};

            if (pedido) {
                searchConditions.$or = [
                    { orderNumber: { $regex: pedido, $options: "i" } },
                ];
            }

            if (fecha) {
                searchConditions.createdAt = { $gte: new Date(fecha), $lt: new Date(fecha + 'T23:59:59') };
            }

            if (estadoPago) {
                searchConditions['payment.status'] = estadoPago;
            }

            if (estadoEnvio) {
                searchConditions.status = estadoEnvio;
            }

            const orders = await Order.find(searchConditions)
                .sort({ createdAt: -1 }) // Ordenar
                .skip(skip)
                .limit(limit)

            const totalOrders = await Order.countDocuments(searchConditions);

            res.status(200).json({
                orders,
                totalOrders,
                currentPage: page,
                totalPages: Math.ceil(totalOrders / limit),
            });

        } catch (error) {
            // console.error(error);
            res.status(500).json({ message: 'Error al obtener las órdenes' });
            return;
        }
    }

    static async getOrdersByUser(req: Request, res: Response) {
        try {

            const page = parseInt(req.query.page as string) || 1;
            let limit = parseInt(req.query.limit as string) || 5;
            const userId = req.user._id;

            const skip = (page - 1) * limit;

            // Limitar a maximo 50
            if (limit > 50) {
                limit = 50;
            }

            const orders = await Order.find({ user: userId })
                .sort({ createdAt: -1 }) // Ordenar por fecha de creación
                .skip(skip)
                .limit(limit)

            const totalOrders = await Order.countDocuments({ user: userId });

            res.status(200).json({
                orders,
                totalOrders,
                currentPage: page,
                totalPages: Math.ceil(totalOrders / limit),
            });
        } catch (error) {
            // console.error(error);
            res.status(500).json({ message: 'Error al obtener las órdenes del usuario' });
            return;
        }
    }

    static async getOrderById(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const userId = req.user._id;
            const rol = req.user.rol;

            const order = await Order.findById(id)
                .populate({ path: 'items.productId', select: 'nombre imagenes sku barcode' })
                .populate('user', 'nombre apellidos email') // Popula el usuario si es necesario

            if (!order) {
                res.status(404).json({ message: 'Orden no encontrada' });
                return;
            }

            if (rol !== 'administrador' && order.user._id.toString() !== userId.toString()) {
                res.status(403).json({ message: 'No tienes permiso para acceder a esta orden' });
                return;
            }

            res.status(200).json(order);
        } catch (error) {
            // console.error(error);
            res.status(500).json({ message: 'Error al obtener la orden' });
            return;
        }
    }

    static async createOrderFromPayment(req: Request, res: Response) {
        try {
            const { userId, items, totalPrice, shippingAddress, paymentMethod, paymentStatus, trackingId } = req.body;

            // Validar que los datos necesarios estén presentes
            if (!userId || !items || !totalPrice || !shippingAddress || !paymentMethod || !paymentStatus) {
                res.status(400).json({ message: 'Datos incompletos para crear la orden' });
                return;
            }

            const totalOrders = await Order.countDocuments();
            const orderNumber = `ORD-${totalOrders + 1}`; // Generar un número de orden único

            // Crear la orden
            const newOrder = new Order({
                orderNumber,
                user: userId,
                items,
                totalPrice,
                shippingAddress,
                paymentMethod,
                paymentStatus,
                trackingId: trackingId || null,
            });

            await newOrder.save();

            res.status(201).json({ message: 'Orden creada exitosamente', order: newOrder });

        } catch (error) {
            console.error('❌ Error al guardar orden desde webhook:', error);
        }
    }

    // *** REPORTS ***


    static async getSummaryOrders(req: Request, res: Response) {
        try {
            const { fechaInicio, fechaFin } = req.query;

            if (!fechaInicio || !fechaFin || typeof fechaInicio !== "string" || typeof fechaFin !== "string") {
                res.status(400).json({ message: "Debe proporcionar fechaInicio y fechaFin válidas" });
                return;
            }

            const startDate = startOfDay(parseISO(fechaInicio));
            const endDate = endOfDay(parseISO(fechaFin));

            const orders = await Order.find({
                createdAt: { $gte: startDate, $lte: endDate }
            }).populate("items.productId");

            // Inicializar métricas
            let grossSales = 0;
            let netSales = 0;
            let numberOrdersPagadas = 0;
            let numberOrdersPendientes = 0;
            let numberOrdersCanceladas = 0;
            let totalUnitsSold = 0;
            let margin = 0;

            for (const order of orders) {
                grossSales += order.totalPrice;

                const isPaid = order.payment.status === PaymentStatus.APPROVED;
                const isPending = order.payment.status === PaymentStatus.PENDING;
                const isCanceled = order.status === "canceled";

                if (isPaid) {
                    numberOrdersPagadas++;
                    netSales += order.totalPrice;

                    for (const item of order.items) {
                        const product = item.productId as any;
                        totalUnitsSold += item.quantity;

                        if (product?.costo != null) {
                            margin += (item.price - product.costo) * item.quantity;
                        }
                    }
                }

                if (isPending) numberOrdersPendientes++;
                if (isCanceled) numberOrdersCanceladas++;
            }

            const avgPaidOrderValue = numberOrdersPagadas > 0 ? netSales / numberOrdersPagadas : 0;
            const marginRate = netSales > 0 ? (margin / netSales) * 100 : 0;

            const summary = {
                grossSales,
                netSales,
                numberOrders: orders.length,
                numberOrdersPagadas,
                numberOrdersPendientes,
                numberOrdersCanceladas,
                totalUnitsSold,
                margin,
                marginRate: `${marginRate.toFixed(2)}%`,
                avgPaidOrderValue
            };

            res.json(summary);
            return;

        } catch (error) {
            console.error("Error en getSummaryOrders:", error);
            res.status(500).json({ message: "Error al obtener resumen de órdenes" });
            return;
        }
    }

    static async getOrdersOverTime(req: Request, res: Response) {

        try {
            const { fechaInicio, fechaFin } = req.query;

            if (!fechaInicio || !fechaFin || typeof fechaInicio !== "string" || typeof fechaFin !== "string") {
                res.status(400).json({ message: "Debe proporcionar fechaInicio y fechaFin válidas" });
                return;
            }

            const startDate = startOfDay(parseISO(fechaInicio));
            const endDate = endOfDay(parseISO(fechaFin));
            const dateFormat = "%Y-%m-%d"; // Formato de fecha para agrupar por día

            const report = await Order.aggregate([
                {
                    $match: {
                        "payment.status": PaymentStatus.APPROVED,
                        createdAt: { $gte: startDate, $lte: endDate }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: dateFormat, date: "$createdAt" }

                        },
                        totalSales: { $sum: "$totalPrice" },
                        numberOfOrders: { $sum: 1 },
                    }
                },
                {
                    $project: {
                        _id: 0,
                        date: "$_id",
                        numberOfOrders: 1,
                        totalSales: 1
                    }
                },
                { $sort: { date: 1 } }
            ]);

            res.json(report);
            return
        } catch (error) {
            console.error("Error en getOrdersOverTime:", error);
            res.status(500).json({ message: "Error al obtener órdenes por tiempo" });
            return;
        }
    }

    static async getReportOrdersByStatus(req: Request, res: Response) {
        try {
            const { fechaInicio, fechaFin } = req.query;

            if (!fechaInicio || !fechaFin || typeof fechaInicio !== "string" || typeof fechaFin !== "string") {
                res.status(400).json({ message: "Debe proporcionar fechaInicio y fechaFin válidas" });
                return;
            }

            const startDate = startOfDay(parseISO(fechaInicio));
            const endDate = endOfDay(parseISO(fechaFin));

            const report = await Order.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate, $lte: endDate }
                    }
                },
                {
                    $group: {
                        _id: "$status",
                        numberOfOrders: { $sum: 1 },
                    }
                },
                {
                    $project: {
                        _id: 0,
                        status: "$_id",
                        numberOfOrders: 1,
                    }
                },
                { $sort: { status: 1 } }
            ]);

            res.json(report);
            return
        } catch (error) {
            console.error("Error en getReportOrdersByStatus:", error);
            res.status(500).json({ message: "Error al obtener reporte de órdenes por estado" });
            return;
        }
    }

    static async getReportOrdersByMethodPayment(req: Request, res: Response) {
        try {
            const { fechaInicio, fechaFin } = req.query;

            if (!fechaInicio || !fechaFin || typeof fechaInicio !== "string" || typeof fechaFin !== "string") {
                res.status(400).json({ message: "Debe proporcionar fechaInicio y fechaFin válidas" });
                return;
            }

            const startDate = startOfDay(parseISO(fechaInicio));
            const endDate = endOfDay(parseISO(fechaFin));

            const report = await Order.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate, $lte: endDate }
                    }
                },
                {
                    $group: {
                        _id: "$payment.method",
                        numberOfOrders: { $sum: 1 },
                        totalSales: { $sum: "$totalPrice" },
                    }
                },
                {
                    $project: {
                        _id: 0,
                        method: "$_id",
                        numberOfOrders: 1,
                        totalSales: 1
                    }
                },
                { $sort: { method: 1 } }
            ]);

            res.json(report);
            return
        } catch (error) {
            console.error("Error en getReportOrdersByMethodPayment:", error);
            res.status(500).json({ message: "Error al obtener reporte de órdenes por método de pago" });
            return;
        }
    }

    static async getReportOrdersByCity(req: Request, res: Response) {
        try {
            const { fechaInicio, fechaFin } = req.query;

            if (!fechaInicio || !fechaFin || typeof fechaInicio !== "string" || typeof fechaFin !== "string") {
                res.status(400).json({ message: "Debe proporcionar fechaInicio y fechaFin válidas" });
                return;
            }

            const startDate = startOfDay(parseISO(fechaInicio));
            const endDate = endOfDay(parseISO(fechaFin));

            const report = await Order.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate, $lte: endDate }
                    }
                },
                {
                    $group: {
                        _id: "$shippingAddress.departamento",
                        numberOfOrders: { $sum: 1 },
                        totalSales: { $sum: "$totalPrice" },
                    }
                },
                {
                    $project: {
                        _id: 0,
                        department: "$_id",
                        numberOfOrders: 1,
                        totalSales: 1
                    }
                },
                { $sort: { department: 1 } }
            ]);

            res.json(report);
            return
        } catch (error) {
            console.error("Error en getReportOrdersByCity:", error);
            res.status(500).json({ message: "Error al obtener reporte de órdenes por ciudad" });
            return;
        }
    }
}