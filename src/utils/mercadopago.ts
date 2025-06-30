
import { MercadoPagoConfig, Preference } from "mercadopago";
import dotenv from 'dotenv';

// dotenv.config();

const mercadopago = new MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '',
})

console.log('MercadoPago initialized with access token:', mercadopago.accessToken);

const preference = new Preference(mercadopago);

export { preference };