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
          body: "Informamos que tu pedido ha sido entregado correctamente. Esperamos que disfrutes de tu compra y quedamos atentos a cualquier consulta."
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
          body: `El estado de tu orden ha cambiado de forma administrativa.`
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
              ${
                item.variantAttributes
                  ? `<div style="font-size:12px; color:#9a9a9a; margin-top:3px;">
                      ${Object.entries(item.variantAttributes)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(" · ")}
                    </div>`
                  : ""
              }
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
        <p style="margin:0 0 36px; font-size:14px; color:#6a6a6a; line-height:1.6;">Tu pedido ha sido confirmado y está siendo procesado. Gracias por confiar en nosotros.</p>
        
        <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="margin-bottom:12px;">
          <tr>
            <td style="padding:16px 20px; background-color:#f7f7f7; border-radius:8px;">
              <span style="font-size:11px; color:#9a9a9a; text-transform:uppercase; letter-spacing:0.08em; display:block; margin-bottom:4px;">Número de pedido</span>
              <span style="font-size:15px; font-weight:700; color:#0f0f0f; font-family:'Courier New', Courier, monospace; letter-spacing:0.03em;">#${orderId}</span>
            </td>
          </tr>
        </table>
        
        <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="margin-bottom:36px;">
          <tr>
            <td style="padding:16px 20px; background-color:#f7f7f7; border-radius:8px;">
              <span style="font-size:11px; color:#9a9a9a; text-transform:uppercase; letter-spacing:0.08em; display:block; margin-bottom:4px;">Dirección de envío</span>
              <span style="font-size:14px; color:#3a3a3a; font-weight:500;">${shippingMethod}</span>
            </td>
          </tr>
        </table>
        
        <p style="margin:0 0 12px; font-size:11px; color:#9a9a9a; text-transform:uppercase; letter-spacing:0.08em; font-weight:600;">Resumen del pedido</p>
        
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:1px solid #e8e8e8;">
              <th style="padding:8px 0; font-size:11px; color:#b0b0b0; text-align:left; font-weight:500; width:60px;">&nbsp;</th>
              <th style="padding:8px 12px; font-size:11px; color:#b0b0b0; text-align:left; font-weight:500;">Producto</th>
              <th style="padding:8px 8px; font-size:11px; color:#b0b0b0; text-align:center; font-weight:500;">Cant.</th>
              <th style="padding:8px 0; font-size:11px; color:#b0b0b0; text-align:right; font-weight:500;">Subtotal</th>
            </tr>
          </thead>
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

        <p style="margin:32px 0 0; font-size:13px; color:#9a9a9a; line-height:1.6;">
          Recibirás un correo de seguimiento cuando tu pedido sea despachado. Ante cualquier consulta escríbenos a
          <a href="mailto:contacto@gophone.pe" style="color:#0f0f0f; font-weight:600; text-decoration:none;">contacto@gophone.pe</a> o contáctanos por WhatsApp al 
          <a href="https://wa.me/51925054636" target="_blank" style="color:#25D366; font-weight:600; text-decoration:none;">+51 925 054 636</a>.
        </p>
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
          <a href="mailto:contacto@gophone.pe" style="color:#0f0f0f; font-weight:600; text-decoration:none;">contacto@gophone.pe</a> o contáctanos de inmediato por WhatsApp haciendo clic aquí: 
          <a href="https://wa.me/51925054636" target="_blank" style="color:#25D366; font-weight:600; text-decoration:none;">+51 925 054 636</a>.
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