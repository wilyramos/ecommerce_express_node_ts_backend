// File: backend/src/modules/order-v3/order.schema.ts
import { z } from 'zod';
import { OrderStatus, PaymentStatus } from '../../models/Order';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

// ============================================================================
// ── SUB-ESQUEMAS BASE
// ============================================================================

export const CustomerProfileInputSchema = z.object({
    nombre: z.string().trim().min(1, 'El nombre es requerido'),
    apellidos: z.string().trim().min(1, 'Los apellidos son requeridos'),
    email: z.string().trim().email('Ingresa un correo electrónico válido'),
    telefono: z.string().trim().min(7, 'El teléfono debe tener al menos 7 dígitos'),
    tipoDocumento: z.enum(['DNI', 'RUC', 'CE']).optional(),
    numeroDocumento: z.string().trim().optional()
});

export const ShippingAddressInputSchema = z.object({
    departamento: z.string().trim().min(1, 'El departamento es requerido'),
    provincia: z.string().trim().min(1, 'La provincia es requerida'),
    distrito: z.string().trim().min(1, 'El distrito es requerido'),
    direccion: z.string().trim().min(1, 'La dirección es requerida'),
    numero: z.string().trim().optional(),
    pisoDpto: z.string().trim().optional(),
    referencia: z.string().trim().optional()
});

export const CartItemInputSchema = z.object({
    productId: z.string().regex(objectIdRegex, 'ID de producto inválido'),
    variantId: z.string().regex(objectIdRegex, 'ID de variante inválido').optional(),
    quantity: z.number().int().positive('La cantidad debe ser mayor a 0')
});

// ============================================================================
// ── ESQUEMAS DE VALIDACIÓN REQUEST (validateRequest)
// ============================================================================

export const CreateOrderDTOSchema = z.object({
    body: z.object({
        customerProfile: CustomerProfileInputSchema,
        shippingAddress: ShippingAddressInputSchema,
        items: z.array(CartItemInputSchema).min(1, 'El carrito no puede estar vacío'),
        shippingMethod: z.string().trim().optional(),
        notes: z.string().trim().max(300, 'Las notas no pueden superar 300 caracteres').optional(),
        currency: z.string().default('PEN'),
        discountCode: z.string().trim().optional()
    })
});

export const ChargeOrderSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, 'ID de orden inválido')
  }),

  body: z.object({
    tokenId: z.string().trim().min(1, 'El tokenId de Culqi es requerido'),

    deviceFingerPrintId: z
      .string()
      .trim()
      .min(1, 'El deviceFingerPrintId de Culqi es requerido'),

    authentication_3DS: z
      .object({
        xid: z.string(),
        cavv: z.string(),
        eci: z.string(),
        protocolVersion: z.string(),
        directoryServerTransactionId: z.string().optional()
      })
      .optional()
  })
});

export const UpdateOrderStatusSchema = z.object({
    params: z.object({
        id: z.string().regex(objectIdRegex, 'ID de orden inválido')
    }),
    body: z.object({
        status: z.nativeEnum(OrderStatus, {
            
        }),
        reason: z.string().trim().max(200).optional()
    })
});

export const GetOrderByIdSchema = z.object({
    params: z.object({
        id: z.string().regex(objectIdRegex, 'ID de orden inválido')
    })
});

export const GetOrderByNumberSchema = z.object({
    params: z.object({
        orderNumber: z.string().trim().min(1, 'El número de orden es requerido')
    })
});

export const OrderFiltersQuerySchema = z.object({
    query: z.object({
        status: z.nativeEnum(OrderStatus).optional(),
        paymentStatus: z.nativeEnum(PaymentStatus).optional(),
        email: z.string().trim().optional(),
        orderNumber: z.string().trim().optional(),
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().positive().max(100).default(10)
    }).optional()
});

// ============================================================================
// ── TIPOS INFERIDOS (TypeScript DTOs)
// ============================================================================

export type CreateOrderInput = z.infer<typeof CreateOrderDTOSchema>['body'];
export type ChargeOrderInput = z.infer<typeof ChargeOrderSchema>['body'];
export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusSchema>['body'];
export type OrderFiltersQuery = z.infer<typeof OrderFiltersQuerySchema>['query'];