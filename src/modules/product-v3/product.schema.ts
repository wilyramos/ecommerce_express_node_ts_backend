// backend/src/modules/product/product.schema.ts
import { z } from 'zod';

export const searchAdminSchema = z.object({
    query: z.object({
        q: z.string().min(1, 'El término de búsqueda es requerido'),
        limit: z.string().regex(/^\d+$/, 'El límite debe ser un número entero').optional().default('10'),
    })
});