// File: backend/src/modules/user-v3/user.schema.ts
import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const roles = ['cliente', 'administrador', 'vendedor'] as const;
const tiposDocumento = ['DNI', 'RUC', 'CE'] as const;

export const UserAddressSchema = z.object({
  departamento: z.string().trim().optional(),
  provincia: z.string().trim().optional(),
  distrito: z.string().trim().optional(),
  direccion: z.string().trim().optional(),
  numero: z.string().trim().optional(),
  pisoDpto: z.string().trim().optional(),
  referencia: z.string().trim().optional()
});

export const CreateUserSchema = z.object({
  body: z.object({
    nombre: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres'),
    apellidos: z.string().trim().optional(),
    tipoDocumento: z.enum(tiposDocumento).optional(),
    numeroDocumento: z.string().trim().optional(),
    email: z.string().trim().email('Ingresa un correo electrónico válido'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional(),
    telefono: z.string().trim().optional(),
    direccion: UserAddressSchema.optional(),
    rol: z.enum(roles).default('cliente'),
    isActive: z.boolean().default(true)
  })
});

export const UpdateUserSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, 'ID de usuario inválido')
  }),
  body: z.object({
    nombre: z.string().trim().min(2).optional(),
    apellidos: z.string().trim().optional(),
    tipoDocumento: z.enum(tiposDocumento).optional(),
    numeroDocumento: z.string().trim().optional(),
    email: z.string().trim().email().optional(),
    telefono: z.string().trim().optional(),
    direccion: UserAddressSchema.optional(),
    rol: z.enum(roles).optional()
  })
});

export const UpdateProfileSchema = z.object({
  body: z.object({
    nombre: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').optional(),
    apellidos: z.string().trim().optional(),
    tipoDocumento: z.enum(tiposDocumento).optional(),
    numeroDocumento: z.string().trim().optional(),
    telefono: z.string().trim().optional(),
    direccion: UserAddressSchema.optional()
  })
});

export const ChangePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'La contraseña actual es requerida'),
    newPassword: z.string().min(6, 'La nueva contraseña debe tener al menos 6 caracteres')
  })
});

export const GetUserByIdSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, 'ID de usuario inválido')
  })
});

export const UserFiltersQuerySchema = z.object({
  query: z.object({
    search: z.string().trim().optional(),
    rol: z.enum(roles).optional(),
    isActive: z.enum(['true', 'false']).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10)
  }).optional()
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>['body'];
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>['body'];
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>['body'];
export type UserFiltersQuery = z.infer<typeof UserFiltersQuerySchema>['query'];