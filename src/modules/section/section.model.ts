import { Schema, model, Document, Types } from 'mongoose';

export type SectionType = 'featured_collections' | 'product_grid' | 'rich_text';
export type VideoAspectRatio = '9:16' | '1:1' | '16:9';

export interface ISectionBlock {
    title?: string;
    subtitle?: string;
    imageUrl?: string;
    videoUrl?: string; // Ruta/URL directa de almacenamiento de video
    aspectRatio: VideoAspectRatio; // Formato de visualización del bloque
    linkTo?: string;            
    productId?: Types.ObjectId; 
}

export interface ISection extends Document {
    title: string;              
    slug: string;               
    type: SectionType;
    order: number;
    isActive: boolean;
    settings: {
        bodyText?: string;        
        gridColumns?: number;     
    };
    blocks: ISectionBlock[];
    createdAt: Date;
    updatedAt: Date;
}

const SectionSchema = new Schema<ISection>({
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    type: {
        type: String,
        required: true,
        enum: ['featured_collections', 'product_grid', 'rich_text']
    },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    settings: {
        bodyText: { type: String },
        gridColumns: { type: Number, default: 4 }
    },
    blocks: {
        type: [{
            title: { type: String, trim: true },
            subtitle: { type: String, trim: true },
            imageUrl: { type: String },
            videoUrl: { type: String, default: "" },
            aspectRatio: { 
                type: String, 
                enum: ['9:16', '1:1', '16:9'], 
                default: '16:9' 
            },
            linkTo: { type: String },
            productId: { type: Schema.Types.ObjectId, ref: 'Product' }
        }],
        validate: {
            validator: function (val: ISectionBlock[]) {
                return val.length <= 8;
            },
            message: 'La sección estructural excede el límite máximo de 8 bloques de contenido.'
        }
    }
}, { timestamps: true });

SectionSchema.index({ isActive: 1, order: 1 });

export const Section = model<ISection>('Section', SectionSchema);