// File: backend/src/emails/OrderEmail.ts

import { resend } from "../config/resend";
import { baseEmailTemplate } from "./templates/baseEmailTemplate";

interface SendOrderEmailProps {
    to: string;
    subject: string;
    content: string;
}

export class OrderEmail {

    static async sendOrderConfirmationEmail({
        email,
        name,
        orderId,
        totalPrice,
        shippingMethod,
        items
    }: {
        email: string;
        name?: string;
        orderId: string;
        totalPrice: number;
        shippingMethod: string;
        items: { nombre: string; quantity: number }[];
    }) {
        try {
            const itemsHtml = items.map(item => `
      <li><strong>${item.nombre}</strong> - Cantidad: ${item.quantity}</li>
    `).join('');

            const emailContent = baseEmailTemplate({
                title: 'Confirmación de Pedido',
                content: `
        <p>Hola ${name || 'cliente'},</p>
        <p>Tu orden <strong>#${orderId}</strong> ha sido confirmada exitosamente.</p>
        <p>Total pagado: <strong>S/. ${totalPrice.toFixed(2)}</strong></p>
        <p>Método de envío: ${shippingMethod}</p>
        <p>Resumen de tu compra:</p>
        <ul>${itemsHtml}</ul>
        <p>Gracias por confiar en GoPhone.</p>
      `
            });

            const response = await resend.emails.send({
                from: 'GoPhone Cañete <contacto@gophone.pe>',
                to: email,
                subject: '¡Tu orden ha sido confirmada!',
                html: emailContent
            });

            return {
                success: true,
                message: 'Email de confirmación enviado correctamente'
            };
        } catch (error) {
            console.error('❌ Error al enviar el email de confirmación:', error);
            return {
                success: false,
                message: 'Error al enviar el email de confirmación'
            };
        }
    }

}