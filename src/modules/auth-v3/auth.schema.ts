// File: backend/src/modules/auth-v3/auth.schema.ts
import { z } from 'zod';

export const LoginSchema = z.object({
    body: z.object({
        email: z.string().email('Ingresa un correo válido'),
        password: z.string().min(1, 'La contraseña es requerida')
    })
});

export const UpdatePasswordSchema = z.object({
    body: z.object({
        currentPassword: z.string().min(1, 'La contraseña actual es requerida'),
        newPassword: z.string().min(6, 'La nueva contraseña debe tener al menos 6 caracteres')
    })
});

export type LoginInput = z.infer<typeof LoginSchema>['body'];
export type UpdatePasswordInput = z.infer<typeof UpdatePasswordSchema>['body'];