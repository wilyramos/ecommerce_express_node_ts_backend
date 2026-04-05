import { Router } from 'express';
import {
    processSale,
    createQuote,
    convertQuote,
    getSales,
    getQuotes,
    downloadTicket,
    refundSale
} from './sale.controller';

const router = Router();

/**
 * BASE URL: /api/sales/v2
 */

// --- OPERACIONES DE VENTA ---
router.post('/', processSale);           // Crear venta real
router.get('/', getSales);               // Listado de historial de ventas
router.get('/:id/ticket', downloadTicket); // Generar PDF (Venta o Proforma)

// --- OPERACIONES DE PROFORMAS ---
router.post('/quote', createQuote);       // Guardar presupuesto
router.get('/quotes', getQuotes);         // Listar proformas pendientes
router.post('/:id/convert', convertQuote); // El "Botón Mágico"
router.post('/:id/refund', refundSale); // Endpoint para devoluciones

export default router;