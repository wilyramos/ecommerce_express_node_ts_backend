// File: backend/src/routes/webhookRouter.ts

import { Router } from 'express';
import { WebhookController } from '../controllers/webhookController';

const router = Router();

// Mercado Pago
router.post('/mercadopago',
    WebhookController.handleWebHookMercadoPago
);

// Izipay
router.post('/izipay',
    WebhookController.handleWebHookIzipay
);

// Culqi — registrar en CulqiPanel > Eventos > Webhooks
// Eventos: order.status.changed  (Yape, PagoEfectivo, billeteras)
//          charge.status.changed (tarjeta, opcional)
// URL: https://tudominio.com/api/webhooks/culqi
router.post('/culqi',
    WebhookController.handleWebHookCulqi
);

export default router;