// File: backend/src/jobs/orderCleanup.job.ts

import cron from 'node-cron';
import { orderService } from '../modules/order/order.service';

/**
 * Tarea programada: Se ejecuta cada hora
 * Cancela órdenes en 'awaiting_payment' creadas hace más de 24 horas.
 */
export function initOrderCleanupJob(): void {
    // Cron sintaxis: "0 * * * *" -> Minuto 0 de cada hora
    cron.schedule('0 * * * *', async () => {
        try {
            console.log('⏰ Ejecutando revisión de órdenes expiradas...');
            await orderService.cancelExpiredOrders(24);
        } catch (error) {
            console.error('❌ Error ejecutando el cron de órdenes expiradas:', error);
        }
    });

    console.log('✅ Cron job de limpieza de órdenes inicializado.');
}