import mongoose, { Schema, Document, Types } from 'mongoose';

// Subesquema para atributos de categoría
export interface ICategoryAttribute {
    name: string;
    values: string[];
}

export interface ICategory extends Document {
    nombre: string;
    descripcion?: string;
    slug?: string;
    parent?: Types.ObjectId;
    attributes?: ICategoryAttribute[];
    createdAt?: Date;
    updatedAt?: Date;
}

// Subschema para atributo individual
const categoryAttributeSchema = new Schema<ICategoryAttribute>(
    {
        name: { type: String, required: true, trim: true },
        values: [{ type: String, required: true, trim: true }],
    },
    { _id: false } // No queremos un _id para cada atributo
);

// Esquema de categoría
const categorySchema = new Schema<ICategory>(
    {
        nombre: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        descripcion: { type: String, trim: true },
        slug: { type: String, unique: true, trim: true },

        parent: {
            type: Schema.Types.ObjectId,
            ref: 'Category',
            default: null,
        },

        // Atributos de la categoría
        attributes: [categoryAttributeSchema],
    },
    { timestamps: true }
);

const Category = mongoose.model<ICategory>('Category', categorySchema);
export default Category;
