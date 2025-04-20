import mongoose, { Schema, Document } from 'mongoose';

export interface ICategory extends Document {
    nombre: string;
    descripcion?: string;
    slug?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

const categorySchema = new Schema<ICategory>(
    {
        nombre: {
            type: String, required: true, unique: true,
            trim: true
        },
        descripcion: { type: String, trim: true },
        slug: { type: String, unique: true, trim: true },
    },
    { timestamps: true }
);

const Category = mongoose.model<ICategory>('Category', categorySchema);
export default Category;