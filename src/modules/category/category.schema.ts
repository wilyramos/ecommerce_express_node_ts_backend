import { z } from 'zod';

export const CategoryAttributeSchema = z.object({
    name: z.string().min(1, 'El nombre del atributo es requerido'),
    values: z.array(z.string()).min(1, 'Debe proveer al menos un valor para el atributo'),
    isVariant: z.boolean().optional().default(false),
    icon: z.string().nullable().optional(),
    isFilterable: z.boolean().optional().default(true),
});

export const CreateCategorySchema = z.object({
    nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
    descripcion: z.string().optional(),
    slug: z.string().optional(),
    parent: z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID de categoría padre inválido').nullable().optional(),
    image: z.string().optional(),
    isActive: z.boolean().optional().default(true),
    order: z.number().int().optional().default(0),
    attributes: z.array(CategoryAttributeSchema).optional().default([]),
});

export const UpdateCategorySchema = CreateCategorySchema.partial();

export const BulkStatusSchema = z.object({
    ids: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID inválido')).min(1, 'Debe seleccionar al menos un registro'),
    isActive: z.boolean(),
});

export const BulkDeleteSchema = z.object({
    ids: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID inválido')).min(1, 'Debe seleccionar al menos un registro'),
});

export const ReorderCategoriesSchema = z.object({
    items: z.array(
        z.object({
            id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID inválido'),
            order: z.number().int(),
            parent: z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID inválido').nullable().optional(),
        })
    ).min(1, 'Debe proveer elementos a ordenar'),
});