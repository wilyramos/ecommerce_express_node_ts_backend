// backend/src/modules/comparison/comparison.model.ts
import mongoose, { Schema, Document, PopulatedDoc, Types } from 'mongoose';
import { IProduct } from '../../models/Product';

// 1. ESPECIFICACIONES: Limpias para alimentar directamente la Tabla Comparativa Visual
export interface IComparisonSpec {
    key: string;               // Ej: "Cámara Principal", "Batería"
    values: string[];          // Ej: ["108 MP", "48 MP"]
    category?: string;         // Ej: "Cámaras" (Para agrupar las filas de la tabla)
    isKeyDifference?: boolean; // Si es true, resalta la fila con un fondo de color llamativo
}

// 2. PUNTUACIONES: Datos numéricos puros para generar los Gráficos Interactivos
export interface IProductScore {
    criterion: string;         // Ej: "Rendimiento", "Cámara", "Batería"
    score: number;             // Escala 0-100 para renderizar las barras o el radar
}

// 3. ANÁLISIS EDITORIAL: Puntos directos y visuales por cada producto
export interface IProductEditorial {
    product: Types.ObjectId | PopulatedDoc<IProduct>;
    winnerBadge?: string;      // Insignia visual llamativa. Ej: "Ganador Calidad/Precio" o "Más Potente"
    pros: string[];            // Lista de viñetas cortas (SÍ leen viñetas)
    contras: string[];         // Lista de viñetas cortas
    scores: IProductScore[];   // Alimenta el gráfico interactivo de este producto
}

export interface IFAQItem {
    pregunta: string;
    respuesta: string;
}

export interface IComparisonCTA {
    buttonText: string;
    targetUrl?: string;
    leadFormActive: boolean;   // Si abre el formulario directo para captar su correo/teléfono
}

export interface IComparison extends Document {
    slug: string;
    title: string;
    metaTitle?: string;
    metaDescription?: string;

    // Elementos principales de la pantalla
    products: (Types.ObjectId | PopulatedDoc<IProduct>)[];
    veredictoRapido?: string;  // El único bloque de texto corto arriba del todo (Ej: "Compra A si buscas X, compra B si buscas Y")

    // Bloques estructurados (UI Visual)
    especificaciones: IComparisonSpec[];
    analisisEditorial: IProductEditorial[];
    ctaConfig?: IComparisonCTA;
    faqItems?: IFAQItem[];

    // Control Interno
    isActive: boolean;
    isFeatured?: boolean;
    viewCount?: number;
    deletedAt?: Date | null;
}

// ==================== MONGOOSE SCHEMAS ====================

const productScoreSchema = new Schema<IProductScore>({
    criterion: { type: String, required: true, trim: true },
    score: { type: Number, required: true, min: 0, max: 100 }
}, { _id: false });

const comparisonCTASchema = new Schema<IComparisonCTA>({
    buttonText: { type: String, default: 'Solicitar Cotización Inmediata' },
    targetUrl: { type: String, trim: true },
    leadFormActive: { type: Boolean, default: true }
}, { _id: false });

const productEditorialSchema = new Schema<IProductEditorial>({
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    winnerBadge: { type: String, trim: true, default: '' },
    pros: [{ type: String, trim: true }],
    contras: [{ type: String, trim: true }],
    scores: { type: [productScoreSchema], default: [] }
}, { _id: false });

const comparisonSpecSchema = new Schema<IComparisonSpec>({
    key: { type: String, required: true, trim: true },
    values: [{ type: String, required: true }],
    category: { type: String, trim: true, default: 'General' },
    isKeyDifference: { type: Boolean, default: false }
}, { _id: false });

const faqSchema = new Schema<IFAQItem>({
    pregunta: { type: String, required: true, trim: true },
    respuesta: { type: String, required: true, trim: true }
}, { _id: false });

const comparisonSchema = new Schema<IComparison>({
    slug: { type: String, trim: true, lowercase: true },
    title: { type: String, required: true, trim: true },
    metaTitle: { type: String, trim: true, maxlength: 60 },
    metaDescription: { type: String, trim: true, maxlength: 160 },
    products: {
        type: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
        validate: [
            (val: Types.ObjectId[]) => val.length >= 2,
            'Se requieren al menos 2 productos para realizar una comparativa.'
        ]
    },
    veredictoRapido: { type: String, trim: true },
    especificaciones: { type: [comparisonSpecSchema], default: [] },
    analisisEditorial: { type: [productEditorialSchema], default: [] },
    ctaConfig: { type: comparisonCTASchema, default: () => ({}) },
    faqItems: { type: [faqSchema], default: [] },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    viewCount: { type: Number, default: 0, min: 0 },
    deletedAt: { type: Date, default: null }
}, { timestamps: true });

comparisonSchema.index({ slug: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } });
comparisonSchema.index({ products: 1 });
comparisonSchema.index({ isActive: 1, isFeatured: -1 });

export default mongoose.model<IComparison>('Comparison', comparisonSchema);