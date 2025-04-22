import nodemailer from 'nodemailer'
import dotenv from 'dotenv' // Import doteenv
dotenv.config() //

const config = () => {
    return {
        host: "live.smtp.mailtrap.io",
        port: +587,
        auth: {
            user: "api",
            pass: "530690e27efefe4d772ea60c4d0d64ba"
        }
    }
}

export const transporter = nodemailer.createTransport(config());