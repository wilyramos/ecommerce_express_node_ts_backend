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
              ? `<div style="font-size:12px; color:#6b7280;">
                  ${Object.entries(item.variantAttributes)
                .map(([k, v]) => `${k}: ${v}`)
                .join(" / ")}
                </div>`
              : "";

          return `
            <tr>
              <td style="padding:8px; border:1px solid #e5e7eb; text-align:center;">
                <img src="${item.imagen || "https://gophone.pe/logo.png"}"
                     alt="${item.nombre}"
                     style="width:60px; height:auto; border-radius:4px;" />
              </td>
              <td style="padding:8px; border:1px solid #e5e7eb;">
                <div style="font-weight:500;">${item.nombre}</div>
                ${variantText}
              </td>
              <td style="padding:8px; border:1px solid #e5e7eb; text-align:center;">
                ${item.quantity}
              </td>
              <td style="padding:8px; border:1px solid #e5e7eb; text-align:right;">
                S/. ${item.price.toFixed(2)}
              </td>
              <td style="padding:8px; border:1px solid #e5e7eb; text-align:right;">
                S/. ${(item.price * item.quantity).toFixed(2)}
              </td>
            </tr>
          `;
        })
        .join("");

      const emailContent = baseEmailTemplate({
        title: "Confirmación de Pedido",
        content: `
          <p>Hola ${name || "cliente"},</p>
          <p>Tu orden <strong>#${orderId}</strong> ha sido confirmada exitosamente.</p>
          <p>Método de envío: <strong>${shippingMethod}</strong></p>

          <h3 style="margin-top:16px;">Resumen de tu compra:</h3>
          <table style="width:100%; border-collapse:collapse; font-size:14px;">
            <thead>
              <tr style="background:#f3f4f6;">
                <th style="padding:8px; border:1px solid #e5e7eb;">Imagen</th>
                <th style="padding:8px; border:1px solid #e5e7eb; text-align:left;">Producto</th>
                <th style="padding:8px; border:1px solid #e5e7eb;">Cantidad</th>
                <th style="padding:8px; border:1px solid #e5e7eb; text-align:right;">Precio</th>
                <th style="padding:8px; border:1px solid #e5e7eb; text-align:right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <p style="text-align:right; font-size:16px; margin-top:10px;">
            <strong>Total pagado: S/. ${totalPrice.toFixed(2)}</strong>
          </p>

          <p>Gracias por confiar en <strong>GoPhone</strong>.</p>
        `
      });

      await resend.emails.send({
        from: "GoPhone Cañete <contacto@gophone.pe>",
        to: email,
        subject: "¡Tu orden ha sido confirmada!",
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
