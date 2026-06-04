// File: backend/src/modules/webhook/webhook.router.ts

import { Router } from 'express';
import { handleWebhookMercadoPago } from './mercadopago.webhook';
import { handleWebhookCulqi } from './culqi.webhook';

const router = Router();

router.post('/mercadopago', handleWebhookMercadoPago);

// Culqi no requiere rawBody ni validación de firma HMAC.
// La seguridad se implementa verificando cada objeto contra la API de Culqi
// directamente en el handler (culqi.verify.ts).
router.post('/culqi', handleWebhookCulqi);

export default router;