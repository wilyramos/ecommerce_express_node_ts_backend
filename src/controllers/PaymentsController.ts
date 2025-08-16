// controllers/paymentController.ts
import { Request, Response } from 'express';
import { preference } from '../utils/mercadopago';
import { payment } from '../utils/mercadopago';



export class PaymentsController {

    static async createPreference(req: Request, res: Response) {
        try {
            const { items, payer, orderId } = req.body;

            console.log('Received request payer:', payer);

            // console.log('Creating payment preference with items:', req.body);

            if (!items || !Array.isArray(items)) {
                res.status(400).json({ message: 'Items are required' });
                return;
            }

            if (!orderId) {
                res.status(400).json({ message: 'orderId is required in metadata' });
                return;
            }

            console.log("payer", payer);

            const preferencePayload = {
                items: items,
                payer: payer,
                back_urls: {
                    success: `${process.env.MP_SUCCESS_URL}?orderId=${orderId}`, // Use the orderId from the request body
                    failure: `${process.env.MP_FAILURE_URL}?orderId=${orderId}`, // Use the orderId from the request body
                    pending: `${process.env.MP_PENDING_URL}?orderId=${orderId}`, // Use the orderId from the request body
                },
                auto_return: 'approved',
                metadata: { // Se puede incluir todos los datos que se necesiten
                    order_id: orderId, // Use the orderId from the request body
                },
                external_reference: orderId, // Use the orderId from the request body
                notification_url: process.env.MP_NOTIFICATION_URL,
            };

            console.log('Creating payment preference with payload:', preferencePayload);

            const response = await preference.create({ body: preferencePayload });

            res.status(200).json({
                init_point: response.init_point,
            });
        } catch (error) {
            // console.error('Error creating payment preference:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    }

    // Process payment mercadopago
    static async processPayment(req: Request, res: Response) {
        try {
            const { token, payment_method_id } = req.body;
            console.log("boddyyy", req.body)
            if (!token || !payment_method_id) {
                res.status(400).json({ message: 'Token and paymentMethodId are required' });
                return;
            }

            const response = await payment.create({
                body: req.body
            });

            console.log("Payment processed successfully:", response);
            // res.status(200).json({
            //     status: response.status,
            //     message: 'Payment processed',
            //     response, 
            // });

            res.status(200).json(response);
        } catch (error) {
            console.error('Error processing payment:', error);
            res.status(500).json({ message: 'Internal Server Error' });
            return;
        }
    }

    static async verifyPayment(req: Request, res: Response) {
        try {
            const { paymentId } = req.params;

            if (!paymentId) {
                res.status(400).json({ message: 'Payment ID is required' });
                return;
            }

            const response = await payment.get({ id: paymentId });

            console.log(response);

            res.status(200).json(response);
        } catch (error) {
            console.error('Error verifying payment:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    }

    static async processPaymentCulqi(req: Request, res: Response) {
        try {
            const { token, order, amount, description, currency_code = "PEN", email } = req.body;

            console.log("📦 Request body:", req.body);

            if (!token && !order) {
                res.status(400).json({ message: "Debe enviar 'token' o 'order'" });
                return;
            }

            if (!amount || !description) {
                res.status(400).json({ message: "Faltan campos obligatorios: amount y description" });
                return;
            }

            const culqiApiKey = process.env.CULQI_API_KEY;

            let culqiResponse;
            let url = "";
            let payload: any = {};

            if (token) {
                // Pago con tarjeta
                url = "https://api.culqi.com/v2/charges";
                payload = {
                    amount, // debe ir en céntimos: 10.00 PEN → 1000
                    currency_code,
                    email,
                    source_id: token,
                    description,
                };
            } else if (order) {
                // Pago con Yape o billetera
                url = `https://api.culqi.com/v2/orders/${order.id}/confirm`;
            }

            culqiResponse = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${culqiApiKey}`,
                },
                body: token ? JSON.stringify(payload) : undefined,
            });

            const data = await culqiResponse.json();

            if (!culqiResponse.ok) {
                console.error("❌ Error de Culqi:", data);
                res.status(culqiResponse.status).json({
                    status: "error",
                    message: data.user_message || "El pago no pudo ser procesado",
                    error: data,
                });
                return;
            }

            console.log("✅ Culqi OK:", data);
            res.status(200).json({
                status: "success",
                message: "Pago procesado exitosamente",
                data,
            });
            return;
        } catch (error) {
            console.error("💥 Error interno:", error);
            res.status(500).json({ message: "Error interno del servidor", error: (error as Error).message });
            return;
        }
    }

    // IZIPAY

    static async createPaymentIzipay(req: Request, res: Response) {
        try {
            const { amount, currency = "PEN", orderId, customer } = req.body;

            console.log("📦 Request body Izipay:", req.body);
            const amountCents = amount * 100;
            // 1️⃣ Validaciones mínimas
            if (!amount || !orderId) {
                res.status(400).json({
                    message: "amount y orderId son obligatorios"
                });
                return;
            }

            const izipayUser = process.env.IZIPAY_USER;
            const izipayPassword = process.env.IZIPAY_PASSWORD;

            const basicAuth = Buffer.from(`${izipayUser}:${izipayPassword}`).toString("base64");

            const notificationUrl =
                process.env.IZIPAY_NOTIFICATION_URL || "";

            // 2️⃣ Payload para Izipay
            const payload = {
                amount: amountCents, // céntimos (S/. 18.00 → 1800)
                currency,
                orderId,
                customer: {
                    email: customer?.email || "cliente@example.com",
                    reference: customer?.reference || orderId
                },
                notificationUrl,
                language: "es-ES"
            };


            // 3️⃣ Llamada a Izipay
            const response = await fetch(
                "https://api.micuentaweb.pe/api-payment/V4/Charge/CreatePayment",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Basic ${basicAuth}`
                    },
                    body: JSON.stringify(payload)
                }
            );

            const data = await response.json();

            // 4️⃣ Manejo de errores HTTP
            if (!response.ok) {
                console.error("💥 Error en Izipay:", data);
                res.status(response.status).json({
                    message: "Error en la creación del pago",
                    error: data
                });
                return;
            }

            // 5️⃣ Respuesta al frontend
            res.json({
                message: "Pago creado exitosamente",
                paymentData: data
            });
        } catch (error) {
            console.error("💥 Error interno Izipay:", error);
            res.status(500).json({
                message: "Error interno del servidor",
                error: (error as Error).message
            });
            return;
        }
    }

    static async validatePaymentIzipay(req: Request, res: Response) {
        try {
            const { paymentId } = req.params;

            if (!paymentId) {
                res.status(400).json({ message: 'Payment ID is required' });
                return;
            }

            const izipayUser = process.env.IZIPAY_USER;
            const izipayPassword = process.env.IZIPAY_PASSWORD;

            const basicAuth = Buffer.from(`${izipayUser}:${izipayPassword}`).toString("base64");

            const response = await fetch(
                `https://api.micuentaweb.pe/api-payment/V4/Charge/GetPayment/${paymentId}`,
                {
                    method: "GET",
                    headers: {
                        Authorization: `Basic ${basicAuth}`
                    }
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Error al obtener el pago Izipay:", errorData);
                res.status(response.status).json({ message: 'Error al obtener el pago', error: errorData });
                return;
            }

            const data = await response.json();
            res.status(200).json(data);
        } catch (error) {
            console.error('Error al validar el pago Izipay:', error);
            res.status(500).json({ message: 'Internal Server Error', error: (error as Error).message });
        }
    }

}