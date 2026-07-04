// File: backend/src/emails/OrderEmailResend.ts

import { resend } from "../config/resend";
import { baseEmailTemplate } from "./templates/baseEmailTemplate";
import type { IOrderItem, OrderStatus } from "../models/Order";

export class OrderEmail {

  // Mapeo local de asuntos para los estados para asegurar independencia en Backend
  private static getSubjectAndMessageByStatus(status: OrderStatus, orderNumber: string): { subject: string; title: string; body: string } {
    switch (status) {
      case 'processing':
        return {
          subject: `Tu pedido #${orderNumber} está en proceso — GoPhone`,
          title: "Pedido en preparación",
          body: "Hemos verificado tu pago correctamente. Tu pedido ya está en manos de nuestro equipo de almacén y preparación."
        };
      case 'shipped':
        return {
          subject: `¡Tu pedido #${orderNumber} ha sido enviado! — GoPhone`,
          title: "Pedido despachado",
          body: "¡Buenas noticias! Tu paquete ya salió de nuestras instalaciones y se encuentra en camino a tu dirección de destino."
        };
      case 'delivered':
        return {
          subject: `Pedido #${orderNumber} entregado — GoPhone`,
          title: "¡Pedido entregado con éxito!",
          body: "El courier nos ha confirmado la entrega de tu pedido. ¡Esperamos que disfrutes de tu nueva adquisición técnica!"
        };
      case 'canceled':
        return {
          subject: `Actualización: Pedido #${orderNumber} cancelado — GoPhone`,
          title: "Pedido Cancelado",
          body: "Te notificamos que tu pedido ha sido cancelado en nuestro sistema. Si se debió a un reembolso o devolución, el proceso financiero ya está en marcha."
        };
      case 'paid_but_out_of_stock':
        return {
          subject: `Importante: Incidencia con tu pedido #${orderNumber} — GoPhone`,
          title: "Incidencia de Stock",
          body: "Detectamos una inconsistencia temporal en el stock de tus productos. Un asesor prioritario se comunicará contigo de inmediato por teléfono."
        };
      default:
        return {
          subject: `Actualización de tu pedido #${orderNumber} — GoPhone`,
          title: "Actualización de Estado",
          body: `El estado de tu orden ha cambiado a de forma administrativa.`
        };
    }
  }

  static async sendOrderConfirmationEmail({
    email,
    name,
    orderId,
    totalPrice,
    shippingMethod,
    items = [],
  }: {
    email: string;
    name?: string;
    orderId: string;
    totalPrice: number;
    shippingMethod: string;
    items?: IOrderItem[];
  }) {
    try {
      const itemsHtml = items
        .map(
          (item) => `
          <tr>
            <td style="padding:14px 0; border-bottom:1px solid #efefef; vertical-align:middle;">
              <img
                src="${item.imagen || "https://gophone.pe/logogophone.png"}"
                alt="${item.nombre}"
                style="width:48px; height:48px; object-fit:cover; border-radius:6px; display:block; background-color:#f5f5f5;"
              />
            </td>
            <td style="padding:14px 12px; border-bottom:1px solid #efefef; vertical-align:middle;">
              <div style="font-size:13px; font-weight:600; color:#0f0f0f; line-height:1.4;">
                ${item.nombre}
              </div>
            </td>
            <td style="padding:14px 8px; border-bottom:1px solid #efefef; text-align:center; vertical-align:middle; white-space:nowrap;">
              <span style="font-size:13px; color:#9a9a9a;">× ${item.quantity}</span>
            </td>
            <td style="padding:14px 0; border-bottom:1px solid #efefef; text-align:right; vertical-align:middle; white-space:nowrap;">
              <span style="font-size:13px; font-weight:600; color:#0f0f0f;">
                S/ ${(item.price * item.quantity).toFixed(2)}
              </span>
            </td>
          </tr>`
        )
        .join("");

      const content = `
        <p style="margin:0 0 6px; font-size:15px; font-weight:600; color:#0f0f0f;">Hola, ${name || "cliente"}</p>
        <p style="margin:0 0 36px; font-size:14px; color:#6a6a6a; line-height:1.6;">Tu pedido ha sido confirmado y está siendo procesado.</p>
        <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="margin-bottom:12px;">
          <tr>
            <td style="padding:16px 20px; background-color:#f7f7f7; border-radius:8px;">
              <span style="font-size:11px; color:#9a9a9a; text-transform:uppercase; display:block; margin-bottom:4px;">Número de pedido</span>
              <span style="font-size:15px; font-weight:700; color:#0f0f0f; font-family:monospace;">#${orderId}</span>
            </td>
          </tr>
        </table>
        <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="margin-bottom:36px;">
          <tr>
            <td style="padding:16px 20px; background-color:#f7f7f7; border-radius:8px;">
              <span style="font-size:11px; color:#9a9a9a; text-transform:uppercase; display:block; margin-bottom:4px;">Dirección de envío</span>
              <span style="font-size:14px; color:#3a3a3a; font-weight:500;">${shippingMethod}</span>
            </td>
          </tr>
        </table>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          <tbody>${itemsHtml}</tbody>
        </table>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;">
          <tr>
            <td style="padding:16px 20px; background-color:#0f0f0f; border-radius:8px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td><span style="font-size:13px; color:rgba(255,255,255,0.5);">Total pagado</span></td>
                  <td align="right"><span style="font-size:18px; font-weight:700; color:#ffffff;">S/ ${totalPrice.toFixed(2)}</span></td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      `;

      const emailContent = baseEmailTemplate({ title: "Pedido confirmado", content });
      await resend.emails.send({
        from: "GoPhone <contacto@gophone.pe>",
        to: email,
        subject: `Pedido #${orderId} confirmado — GoPhone`,
        html: emailContent,
      });

      return { success: true, message: "Email enviado" };
    } catch (error) {
      console.error("❌ Error enviando confirmación:", error);
      return { success: false };
    }
  }

  /**
   * Envía una notificación dinámica en base al nuevo estado logístico
   */
  static async sendOrderStatusUpdateEmail({
    email,
    name,
    orderNumber,
    status,
    trackingNumber,
  }: {
    email: string;
    name: string;
    orderNumber: string;
    status: OrderStatus;
    trackingNumber?: string;
  }) {
    try {
      const config = this.getSubjectAndMessageByStatus(status, orderNumber);

      let trackingHtml = "";
      if (status === 'shipped' && trackingNumber) {
        trackingHtml = `
          <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="margin:20px 0 28px;">
            <tr>
              <td style="padding:16px 20px; background-color:#f0f7ff; border: 1px solid #d0e7ff; border-radius:8px;">
                <span style="font-size:11px; color:#0055b3; text-transform:uppercase; font-weight:bold; display:block; margin-bottom:4px;">Número de Tracking / Guía</span>
                <span style="font-size:16px; font-weight:800; color:#003366; font-family:monospace;">${trackingNumber}</span>
              </td>
            </tr>
          </table>
        `;
      }

      const content = `
        <p style="margin:0 0 6px; font-size:15px; font-weight:600; color:#0f0f0f;">Hola, ${name}</p>
        <p style="margin:0 0 16px; font-size:14px; color:#3a3a3a; line-height:1.6;">
          ${config.body}
        </p>
        
        ${trackingHtml}

        <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="margin-bottom:24px;">
          <tr>
            <td style="padding:14px 20px; background-color:#f7f7f7; border-radius:6px; text-align:center;">
              <span style="font-size:13px; color:#6a6a6a;">Código de Seguimiento: <strong>#${orderNumber}</strong></span>
            </td>
          </tr>
        </table>

        <p style="margin:24px 0 0; font-size:13px; color:#9a9a9a; line-height:1.6;">
          Si tienes alguna consulta sobre este movimiento logístico, escríbenos a 
          <a href="mailto:contacto@gophone.pe" style="color:#0f0f0f; font-weight:600; text-decoration:none;">contacto@gophone.pe</a>.
        </p>
      `;

      const emailContent = baseEmailTemplate({ title: config.title, content });

      await resend.emails.send({
        from: "GoPhone <contacto@gophone.pe>",
        to: email,
        subject: config.subject,
        html: emailContent,
      });

      return { success: true };
    } catch (error) {
      console.error(`❌ Error enviando email de cambio de estado (${status}):`, error);
      return { success: false };
    }
  }
}