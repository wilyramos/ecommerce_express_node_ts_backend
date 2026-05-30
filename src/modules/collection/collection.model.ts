import mongoose, { Schema, Document } from 'mongoose';

export const COLLECTION_TYPES = [
    'featured',       // Curaduría editorial / Selección de expertos
    'new_arrivals',   // Novedades e ingresos recientes
    'best_sellers',   // Los más vendidos / Confianza social
    'on_sale',        // Productos en oferta / Urgencia
    'promotion',      // Promociones comerciales generales
    'theme',          // Agrupaciones por nicho / catálogo (Ej: Especial Gamer)
    'editorial',      // Bloques de contenido especial o artículos
    'seasonal'        // Temporadas (Black Friday, Navidad, Día del Padre)
] as const;

export type CollectionType = typeof COLLECTION_TYPES[number];
export type HomepageLayoutType = 'grid' | 'carousel'; // Estructura simplificada y limpia

export interface ICollection extends Document {
    name: string;
    slug: string;
    type: CollectionType;
    description?: string;
    image?: string;
    bannerImage?: string;
    color?: string;
    order: number;
    startsAt?: Date;
    endsAt?: Date;
    badgeLabel?: string;
    badgeColor?: string;
    seoTitle?: string;
    seoDescription?: string;
    isActive: boolean;
    isSystem: boolean; // Protege colecciones fijas del sistema
    showInHomepage: boolean; // Renderizado condicional en la página de inicio
    homepageOrder: number; // Orden jerárquico de la sección en el Home
    maxHomepageItems: number; // Límite de productos para esta sección
    homepageLayout: HomepageLayoutType; // Diseño visual de la sección ('grid' o 'carousel')
    deletedAt?: Date;
    createdAt?: Date;
    updatedAt?: Date;
}

const collectionSchema = new Schema<ICollection>(
    {
        name: { type: String, required: true, trim: true },
        slug: { type: String, required: true, trim: true },
        type: {
            type: String,
            required: true,
            enum: COLLECTION_TYPES,
        },
        description: { type: String, trim: true },
        image: { type: String, trim: true },
        bannerImage: { type: String, trim: true },
        color: { type: String, trim: true },
        order: { type: Number, default: 0 },
        startsAt: { type: Date, default: null },
        endsAt: { type: Date, default: null },
        badgeLabel: { type: String, trim: true },
        badgeColor: { type: String, trim: true },
        seoTitle: { type: String, trim: true, maxlength: 60 },
        seoDescription: { type: String, trim: true, maxlength: 160 },
        isActive: { type: Boolean, default: true },
        isSystem: { type: Boolean, default: false },
        showInHomepage: { type: Boolean, default: false },
        homepageOrder: { type: Number, default: 0 },
        maxHomepageItems: { type: Number, default: 8, min: 1, max: 50 },
        homepageLayout: {
            type: String,
            enum: ['grid', 'carousel'],
            default: 'grid'
        },
        deletedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

// --- ÍNDICES DE UNICIDAD PARCIAL ---
collectionSchema.index({ slug: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } });
collectionSchema.index({ name: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } });

// --- ÍNDICES DE RENDIMIENTO ---
collectionSchema.index({ isActive: 1, deletedAt: 1, type: 1, order: 1 });
collectionSchema.index({ slug: 1, isActive: 1, deletedAt: 1 });

// Índice Maestro para compilar el esqueleto dinámico de tu Home en milisegundos
collectionSchema.index({ showInHomepage: 1, isActive: 1, deletedAt: 1, homepageOrder: 1 });

const Collection = mongoose.model<ICollection>('Collection', collectionSchema);
export default Collection;