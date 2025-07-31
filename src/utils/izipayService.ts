// services/izipayService.ts
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

interface IzipayResponse {
    answer?: {
        formToken?: string;
    };
}

export async function getFormTokenFromIzipay(
    transactionId: string,
    amount: number
): Promise<{ formToken: string }> {
    const url = 'https://api.micuentaweb.pe/api-payment/V4/Charge/CreatePayment';

    const body = {
        amount,
        currency: 'PEN',
        orderId: transactionId,
        customer: {
            billingDetails: {
                firstName: 'Juan',
                lastName: 'Pérez',
                email: 'juan@example.com',
            },
        },
    };

    const authToken = Buffer.from(`${process.env.IZIPAY_USER}:${process.env.IZIPAY_PASSWORD}`).toString('base64');

    console.log('Auth Token:', authToken);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${authToken}`,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error al obtener el token de Izipay: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as IzipayResponse;

    const formToken = data.answer?.formToken;
    if (!formToken) {
        throw new Error('No se recibió formToken desde Izipay');
    }

    return { formToken };
}
