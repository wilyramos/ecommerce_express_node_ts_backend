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
    items = []
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
        .map((item) => {
          const variantText =
            item.variantAttributes && Object.keys(item.variantAttributes).length > 0
              ? `<div style="font-size:12px; color:#6b7280; margin-top:4px;">
                  ${Object.entries(item.variantAttributes)
                .map(([k, v]) => `${k}: ${v}`)
                .join(" / ")}
                </div>`
              : "";

          return `
            <tr style="border-bottom:1px solid #eee;">
              <td style="padding:10px 0; text-align:center;">
                <img src="${item.imagen || "https://gophone.pe/logo.png"}"
                     alt="${item.nombre}"
                     style="width:60px; height:auto; border-radius:6px; object-fit:cover;" />
              </td>
              <td style="padding:10px 0; text-align:left;">
                <div style="font-weight:500; color:#111827;">${item.nombre}</div>
                ${variantText}
              </td>
              <td style="padding:10px 0; text-align:center; color:#374151;">
                ${item.quantity}
              </td>
              <td style="padding:10px 0; text-align:right; color:#111827;">
                S/. ${item.price.toFixed(2)}
              </td>
              <td style="padding:10px 0; text-align:right; font-weight:500; color:#111827;">
                S/. ${(item.price * item.quantity).toFixed(2)}
              </td>
            </tr>
          `;
        })
        .join("");

      const emailContent = baseEmailTemplate({
        title: "Gracias por tu compra 🛍️",
        content: `
          <div style="font-family:Inter, Arial, sans-serif; color:#111827; font-size:15px; line-height:1.6;">
            <p>Hola <strong>${name || "cliente"}</strong>,</p>
            <p>
              Nos alegra informarte que hemos recibido tu pedido
              <strong>#${orderId}</strong> y está siendo procesado.
            </p>

            <div style="margin:20px 0; background:#f9fafb; border-radius:8px; padding:16px;">
              <p style="margin:0; font-size:14px; color:#374151;">
                <strong>Método de envío:</strong> ${shippingMethod}
              </p>
            </div>

            <h3 style="margin-top:24px; font-size:16px; font-weight:600; color:#111827;">
              Resumen de tu pedido
            </h3>

            <table style="width:100%; border-collapse:collapse; margin-top:10px;">
              <thead>
                <tr style="text-align:left; border-bottom:2px solid #e5e7eb; color:#6b7280; font-size:13px;">
                  <th style="padding:8px 0;">Imagen</th>
                  <th style="padding:8px 0;">Producto</th>
                  <th style="padding:8px 0; text-align:center;">Cant.</th>
                  <th style="padding:8px 0; text-align:right;">Precio</th>
                  <th style="padding:8px 0; text-align:right;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <div style="margin-top:20px; border-top:1px solid #e5e7eb; padding-top:12px; text-align:right;">
              <p style="margin:4px 0; font-size:14px; color:#374151;">Envío: <strong>S/. 0.00</strong></p>
              <p style="margin:4px 0; font-size:16px; font-weight:600; color:#111827;">
                Total pagado: S/. ${totalPrice.toFixed(2)}
              </p>
            </div>

            <p style="margin-top:24px; color:#4b5563; font-size:14px;">
              Recibirás una notificación cuando tu pedido sea enviado.
            </p>

            <p style="margin-top:16px;">
              Gracias por comprar en <strong style="color:#111827;">GoPhone</strong> 💙
            </p>
          </div>
        `
      });

      await resend.emails.send({
        from: "GoPhone Cañete <contacto@gophone.pe>",
        to: email,
        subject: `Tu pedido #${orderId} ha sido confirmado ✅`,
        html: emailContent
      });

      return {
        success: true,
        message: "Email de confirmación enviado correctamente"
      };
    } catch (error) {
      console.error("❌ Error al enviar el email de confirmación:", error);
      return {
        success: false,
        message: "Error al enviar el email de confirmación"
      };
    }
  }
}
