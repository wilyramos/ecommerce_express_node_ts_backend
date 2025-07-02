import { resend } from "../config/resend";
import { baseEmailTemplate } from "./templates/baseEmailTemplate";

interface SendOrderEmailProps {
    to: string;
    subject: string;
    content: string;
}

export class OrderEmail {

    static async sendOrderEmail({ to, subject, content }: SendOrderEmailProps) {

        try {
            const emailContent = baseEmailTemplate({
                title: "Confirmación de Pedido",
                content: content
            });

            const response = await resend.emails.send({
                from: 'mi app <contacto@gophone.pe>',
                to,
                subject,
                html: emailContent
            });

            console.log("Email sent successfully:", response);

            return {
                success: true,
                message: "Order confirmation email sent successfully"
            };

        } catch (error) {
            console.error("Error sending order confirmation email:", error);
            return {
                success: false,
                message: "Failed to send order confirmation email"
            };
        }
    }

    static async sendResetPasswordEmail({ to, subject, content }: SendOrderEmailProps) {
        try {
            const emailContent = baseEmailTemplate({
                title: "Restablecer Contraseña",
                content: content
            });
            const response = await resend.emails.send({
                from: 'GoPhone Cañete <contacto@gophone.pe>',
                to,
                subject,
                html: emailContent
            });

            console.log("Password reset email sent successfully:", response);
            return {
                success: true,
                message: "Password reset email sent successfully"
            };

        } catch (error) {
            console.error("Error sending password reset email:", error);
            return {
                success: false,
                message: "Failed to send password reset email"
            };
        }
    }
}