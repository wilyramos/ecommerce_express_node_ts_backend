import { transporter } from "../config/nodemailer"
 
interface IEmail {
    email: string
    name: string
    token: string
}

export class AuthEmail {
    static async sendEmailResetPassword( user: IEmail ) {


        console.log('sendEmailResetPassword', user);
        await transporter.verify()
        const mailOptions = {
            from: process.env.SMTP_USER,
            to: user.email,
            subject: 'Recuperación de contraseña',
            html: `
                <h1>Hola ${user.name}</h1>
                <p>Has solicitado restablecer tu contraseña. Haz clic en el siguiente enlace para restablecerla:</p>
                <a href="${process.env.FRONTEND_URL}/reset-password?token=${user.token}">Restablecer contraseña</a>

                <p>Si no solicitaste este cambio, ignora este correo.</p>
            `
        }
        console.log('Sending email to:', user.email);
        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully to:', user.email);
    }
}