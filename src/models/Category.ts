import mongoose, { Schema, Document, Types } from 'mongoose';

// Atributos posibles para productos de esta categoría
export interface ICategoryAttribute {
    name: string;        // Ej: "Color", "Talla", "Material"
    values: string[];    // Ej: ["Rojo", "Verde"] o ["S", "M", "L"]
}

export interface ICategory extends Document {
    nombre: string;
    descripcion?: string;
    slug?: string;
    parent?: Types.ObjectId; // Subcategoría (si aplica)
    attributes?: ICategoryAttribute[];
    createdAt?: Date;
    updatedAt?: Date;
}


// Subschema para atributos
const categoryAttributeSchema = new Schema<ICategoryAttribute>(
    {
        name: { type: String, required: true, trim: true },
        values: [{ type: String, required: true, trim: true }],
    },
    { _id: false }
);


// Esquema principal de categoría
const categorySchema = new Schema<ICategory>(
    {
        nombre: { type: String, required: true, unique: true, trim: true },
        descripcion: { type: String, trim: true },
        slug: { type: String, unique: true, trim: true },

        parent: {
            type: Schema.Types.ObjectId,
            ref: 'Category',
            default: null, // null si es categoría raíz
        },

        attributes: [categoryAttributeSchema], // Atributos informativos
    },
    { timestamps: true }
);

const Category = mongoose.model<ICategory>('Category', categorySchema);
export default Category;