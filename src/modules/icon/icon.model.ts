// File: src/modules/icon/icon.model.ts

import mongoose, { Schema, Document, Types } from 'mongoose';

// ── Interface ─────────────────────────────────────────────────────────────────

export interface IIcon extends Document {
    key: string;              // Identificador único usado en Product.especificaciones.icon
    nombre: string;           // Etiqueta visible para el administrador
    mediaId: Types.ObjectId;  // Relación con el modelo Media (archivo real en Cloudinary)
    iconUrl: string;          // Copia de Media.secureUrl para lectura rápida sin populate
    grupo: string;            // Agrupa visualmente en el selector admin (ej: 'confianza', 'tecnico')
    isActive: boolean;
    order: number;
    deletedAt: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
}

// ── Schema ────────────────────────────────────────────────────────────────────

const iconSchema = new Schema<IIcon>(
    {
        key: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },
        nombre: {
            type: String,
            required: true,
            trim: true,
        },
        mediaId: {
            type: Schema.Types.ObjectId,
            ref: 'Media',
            required: true,
        },
        iconUrl: {
            type: String,
            required: true,
            trim: true,
        },
        grupo: {
            type: String,
            trim: true,
            lowercase: true,
            default: 'general',
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        order: {
            type: Number,
            default: 0,
        },
        deletedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

// ── Índices ───────────────────────────────────────────────────────────────────

// Corregido a índice parcial para que acepte múltiples valores 'null' activos sin romper la unicidad
iconSchema.index(
    { key: 1 },
    {
        unique: true,
        partialFilterExpression: { deletedAt: null }
    }
);

// Listado del selector admin (orden + filtro por estado)
iconSchema.index({ isActive: 1, deletedAt: 1, order: 1 });

// Filtro por grupo en el selector
iconSchema.index({ grupo: 1, isActive: 1, deletedAt: 1 });

export default mongoose.model<IIcon>('Icon', iconSchema);