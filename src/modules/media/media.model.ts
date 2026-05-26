// File: src/modules/media/media.model.ts
import { Schema, model, Document, Types } from 'mongoose';

export type ResourceType = 'image' | 'video';
export type MediaFolder = 'products' | 'banners' | 'brands' | 'avatars' | 'collections' | 'general';

export interface IMedia extends Document {
    publicId: string;       // Cloudinary public_id completo
    secureUrl: string;      // URL HTTPS de Cloudinary
    folder: MediaFolder;
    resourceType: ResourceType;
    format: string;         // webp, mp4, etc.
    bytes: number;
    width?: number;
    height?: number;
    duration?: number;      // solo video, en segundos
    uploadedBy?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const mediaSchema = new Schema<IMedia>(
    {
        publicId: { type: String, required: true, unique: true, index: true },
        secureUrl: { type: String, required: true },
        folder: { type: String, required: true, index: true },
        resourceType: { type: String, enum: ['image', 'video'], required: true },
        format: { type: String, required: true },
        bytes: { type: Number, required: true },
        width: { type: Number },
        height: { type: Number },
        duration: { type: Number },
        uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true }
);

export const Media = model<IMedia>('Media', mediaSchema);