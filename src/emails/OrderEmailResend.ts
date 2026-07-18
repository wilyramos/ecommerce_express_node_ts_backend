// File: backend/src/emails/OrderEmailResend.ts

import { resend } from "../config/resend";
import { baseEmailTemplate } from "./templates/baseEmailTemplate";
import type { IOrderItem, OrderStatus } from "../models/Order";
import User from "../models/User";

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

  // Generador de filas HTML de productos reutilizable (Estilo Shopify)
  private static generateItemsHtml(items: IOrderItem[]): string {
    return items.map((item) => `
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
          ${item.variantAttributes ? `
            <div style="font-size:12px; color:#9a9a9a; margin-top:3px;">
              ${Object.entries(item.variantAttributes).map(([k, v]) => `${k}: ${v}`).join(" · ")}
            </div>
          ` : ""}
        </td>
        <td style="padding:14px 8px; border-bottom:1px solid #efefef; text-align:center; vertical-align:middle; white-space:nowrap;">
          <span style="font-size:13px; color:#9a9a9a;">× ${item.quantity}</span>
        </td>
        <td style="padding:14px 0; border-bottom:1px solid #efefef; text-align:right; vertical-align:middle; white-space:nowrap;">
          <span style="font-size:13px; font-weight:600; color:#0f0f0f;">
            S/ ${(item.price * item.quantity).toFixed(2)}
          </span>
        </td>
      </tr>
    `).join("");
  }

  // 1. CORREO PARA EL CLIENTE
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
      const itemsHtml = this.generateItemsHtml(items);

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

      return { success: true, message: "Email enviado al cliente" };
    } catch (error) {
      console.error("❌ Error enviando confirmación al cliente:", error);
      return { success: false };
    }
  }

  // 2. NOTIFICACIÓN PARA ADMINISTRADORES (Estilo Shopify Operaciones)
  static async sendAdminOrderNotificationEmail({
    customerName,
    customerEmail,
    customerPhone,
    orderId,
    totalPrice,
    shippingMethod,
    items = [],
  }: {
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    orderId: string;
    totalPrice: number;
    shippingMethod: string;
    items?: IOrderItem[];
  }) {
    try {
      const admins = await User.find({ rol: "administrador", isActive: true }).select("email");
      const adminEmails = admins.map(admin => admin.email);

      if (adminEmails.length === 0) {
        console.warn("⚠️ No se encontraron administradores activos para notificar.");
        return { success: false, message: "No admins found" };
      }

      const itemsHtml = this.generateItemsHtml(items);

      const content = `
        <p style="margin:0 0 6px; font-size:15px; font-weight:600; color:#0f0f0f;">Notificación de Venta</p>
        <p style="margin:0 0 24px; font-size:14px; color:#3a3a3a; line-height:1.6;">Se ha registrado y pagado un nuevo pedido en la plataforma.</p>
        
        <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="margin-bottom:20px;">
          <tr>
            <td width="50%" style="padding:14px 16px; background-color:#f7f7f7; border-radius:8px 0 0 8px; border-right:1px solid #ffffff;">
              <span style="font-size:10px; color:#9a9a9a; text-transform:uppercase; letter-spacing:0.08em; display:block; margin-bottom:2px;">Pedido</span>
              <span style="font-size:14px; font-weight:700; color:#0f0f0f;">#${orderId}</span>
            </td>
            <td width="50%" style="padding:14px 16px; background-color:#f7f7f7; border-radius:0 8px 8px 0;">
              <span style="font-size:10px; color:#9a9a9a; text-transform:uppercase; letter-spacing:0.08em; display:block; margin-bottom:2px;">Monto Total</span>
              <span style="font-size:14px; font-weight:700; color:#25D366;">S/ ${totalPrice.toFixed(2)}</span>
            </td>
          </tr>
        </table>

        <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="margin-bottom:32px; border:1px solid #e8e8e8; border-radius:8px;">
          <tr>
            <td style="padding:16px;">
              <p style="margin:0 0 8px; font-size:12px; color:#9a9a9a; text-transform:uppercase; letter-spacing:0.08em; font-weight:600;">Datos del Cliente</p>
              <p style="margin:0 0 4px; font-size:14px; color:#0f0f0f;"><strong>Nombre:</strong> ${customerName}</p>
              <p style="margin:0 0 4px; font-size:14px; color:#0f0f0f;"><strong>Email:</strong> ${customerEmail}</p>
              <p style="margin:0 0 4px; font-size:14px; color:#0f0f0f;"><strong>Teléfono:</strong> ${customerPhone || "No registrado"}</p>
              <p style="margin:0; font-size:14px; color:#0f0f0f;"><strong>Método/Dirección de Envío:</strong> ${shippingMethod}</p>
            </td>
          </tr>
        </table>
        
        <p style="margin:0 0 12px; font-size:11px; color:#9a9a9a; text-transform:uppercase; letter-spacing:0.08em; font-weight:600;">Artículos a preparar</p>
        
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

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:28px;">
          <tr>
            <td align="center">
              <a href="${process.env.FRONTEND_URL}/admin/orders/${orderId}" target="_blank" 
                 style="background-color:#0f0f0f; color:#ffffff; padding:12px 24px; font-size:14px; font-weight:600; text-decoration:none; border-radius:6px; display:inline-block;">
                Ver pedido en el Panel de Administración
              </a>
            </td>
          </tr>
        </table>
      `;

      const emailContent = baseEmailTemplate({ title: `Nuevo pedido #${orderId}`, content });
      
      await resend.emails.send({
        from: "GoPhone Operaciones <contacto@gophone.pe>",
        to: adminEmails,
        subject: `[Nueva Venta] Pedido #${orderId} — S/ ${totalPrice.toFixed(2)}`,
        html: emailContent,
      });

      return { success: true, message: "Notificación enviada a los administradores" };
    } catch (error) {
      console.error("❌ Error enviando notificación a los administradores:", error);
      return { success: false };
    }
  }

  // 3. ACTUALIZADO: ENVIAR CAMBIO DE ESTADO LOGÍSTICO INCLUYENDO PRODUCTOS Y TOTAL
  static async sendOrderStatusUpdateEmail({
    email,
    name,
    orderNumber,
    status,
    totalPrice,
    items = [],
    trackingNumber,
  }: {
    email: string;
    name: string;
    orderNumber: string;
    status: OrderStatus;
    totalPrice: number;
    items?: IOrderItem[];
    trackingNumber?: string;
  }) {
    try {
      const config = this.getSubjectAndMessageByStatus(status, orderNumber);
      const itemsHtml = this.generateItemsHtml(items);

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

        <!-- Código de Pedido en caja limpia -->
        <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="margin-bottom:24px;">
          <tr>
            <td style="padding:14px 20px; background-color:#f7f7f7; border-radius:6px; text-align:center;">
              <span style="font-size:13px; color:#6a6a6a;">Identificador del Pedido: <strong>#${orderNumber}</strong></span>
            </td>
          </tr>
        </table>

        <!-- Resumen de Productos del cambio de estado -->
        <p style="margin:24px 0 12px; font-size:11px; color:#9a9a9a; text-transform:uppercase; letter-spacing:0.08em; font-weight:600;">Detalle de los artículos</p>
        
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; margin-bottom:20px;">
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
        
        <!-- Total Final -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:32px;">
          <tr>
            <td style="padding:14px 20px; background-color:#0f0f0f; border-radius:8px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td><span style="font-size:13px; color:rgba(255,255,255,0.5);">Total del pedido</span></td>
                  <td align="right"><span style="font-size:16px; font-weight:700; color:#ffffff;">S/ ${totalPrice.toFixed(2)}</span></td>
                </tr>
              </table>
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