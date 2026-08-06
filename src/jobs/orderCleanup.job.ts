import cron from 'node-cron';
import { orderService } from '../modules/order/order.service';

/**
 * Tarea programada: Se ejecuta 1 vez al día en la madrugada (03:00 AM).
 * Cancela órdenes en 'awaiting_payment' creadas hace más de 24 horas.
 */
export function initOrderCleanupJob(): void {
    // Cron sintaxis: "0 3 * * *" -> Minuto 0, Hora 3 (03:00 AM todos los días)
    cron.schedule('0 3 * * *', async () => {
        try {
            console.log('⏰ Ejecutando revisión diaria de órdenes expiradas...');
            await orderService.cancelExpiredOrders(24);
        } catch (error) {
            console.error('❌ Error ejecutando el cron de órdenes expiradas:', error);
        }
    }, {
        timezone: "America/Lima" // Asegura que las 03:00 AM correspondan a la hora local de Perú (-05:00)
    });

    console.log('✅ Cron job de limpieza de órdenes inicializado (Diario a las 03:00 AM - America/Lima).');
}