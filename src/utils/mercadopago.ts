
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
import dotenv from 'dotenv';

// dotenv.config();

const mercadopago = new MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '',
})

const preference = new Preference(mercadopago);
const payment = new Payment(mercadopago);

export { preference, payment };