import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICategory extends Document {
    nombre: string;
    descripcion?: string;
    slug?: string;
    parent?: Types.ObjectId; // Reference to another category
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

        // Reference to another category
        parent: {
            type: Schema.Types.ObjectId,
            ref: 'Category',
            default: null
        }
    },
    { timestamps: true }
);

const Category = mongoose.model<ICategory>('Category', categorySchema);
export default Category;