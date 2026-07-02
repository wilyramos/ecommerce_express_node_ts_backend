// File: backend/src/emails/OrderEmailResend.ts

import { resend } from "../config/resend";
import { baseEmailTemplate } from "./templates/baseEmailTemplate";
import type { IOrderItem } from "../models/Order";

export class OrderEmail {
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
      // ── Filas de productos ────────────────────────────────────────────────
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

      // ── Contenido del email ───────────────────────────────────────────────
      const content = `
        <!-- Saludo -->
        <p style="margin:0 0 6px; font-size:15px; font-weight:600; color:#0f0f0f;">
          Hola, ${name || "cliente"}
        </p>
        <p style="margin:0 0 36px; font-size:14px; color:#6a6a6a; line-height:1.6;">
          Tu pedido ha sido confirmado y está siendo procesado. 
          Gracias por confiar en nosotros.
        </p>

        <!-- Número de orden -->
        <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="margin-bottom:12px;">
          <tr>
            <td style="padding:16px 20px; background-color:#f7f7f7; border-radius:8px;">
              <span style="font-size:11px; color:#9a9a9a; text-transform:uppercase; letter-spacing:0.08em; display:block; margin-bottom:4px;">
                Número de pedido
              </span>
              <span style="font-size:15px; font-weight:700; color:#0f0f0f; font-family:'Courier New', Courier, monospace; letter-spacing:0.03em;">
                #${orderId}
              </span>
            </td>
          </tr>
        </table>

        <!-- Dirección de envío -->
        <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="margin-bottom:36px;">
          <tr>
            <td style="padding:16px 20px; background-color:#f7f7f7; border-radius:8px;">
              <span style="font-size:11px; color:#9a9a9a; text-transform:uppercase; letter-spacing:0.08em; display:block; margin-bottom:4px;">
                Dirección de envío
              </span>
              <span style="font-size:14px; color:#3a3a3a; font-weight:500;">
                ${shippingMethod}
              </span>
            </td>
          </tr>
        </table>

        <!-- Encabezado resumen -->
        <p style="margin:0 0 12px; font-size:11px; color:#9a9a9a; text-transform:uppercase; letter-spacing:0.08em; font-weight:600;">
          Resumen del pedido
        </p>

        <!-- Tabla de productos -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
          style="border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:1px solid #e8e8e8;">
              <th style="padding:8px 0; font-size:11px; color:#b0b0b0; text-align:left; font-weight:500; width:60px;">&nbsp;</th>
              <th style="padding:8px 12px; font-size:11px; color:#b0b0b0; text-align:left; font-weight:500;">Producto</th>
              <th style="padding:8px 8px; font-size:11px; color:#b0b0b0; text-align:center; font-weight:500;">Cant.</th>
              <th style="padding:8px 0; font-size:11px; color:#b0b0b0; text-align:right; font-weight:500;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <!-- Total -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;">
          <tr>
            <td style="padding:16px 20px; background-color:#0f0f0f; border-radius:8px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="font-size:13px; color:rgba(255,255,255,0.5);">Total pagado</span>
                  </td>
                  <td align="right">
                    <span style="font-size:18px; font-weight:700; color:#ffffff;">
                      S/ ${totalPrice.toFixed(2)}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Aviso final -->
        <p style="margin:32px 0 0; font-size:13px; color:#9a9a9a; line-height:1.6;">
          Recibirás un correo de seguimiento cuando tu pedido sea despachado.
          Ante cualquier consulta escríbenos a
          <a href="mailto:contacto@gophone.pe" style="color:#0f0f0f; font-weight:600; text-decoration:none;">
            contacto@gophone.pe
          </a>.
        </p>
      `;

      const emailContent = baseEmailTemplate({
        title: "Pedido confirmado",
        content,
      });

      await resend.emails.send({
        from: "GoPhone <contacto@gophone.pe>",
        to: email,
        subject: `Pedido #${orderId} confirmado — GoPhone`,
        html: emailContent,
      });

      return { success: true, message: "Email de confirmación enviado correctamente" };
    } catch (error) {
      console.error("❌ Error al enviar el email de confirmación:", error);
      return { success: false, message: "Error al enviar el email de confirmación" };
    }
  }
}