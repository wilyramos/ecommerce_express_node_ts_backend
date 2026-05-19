import { Request, Response } from 'express';
import slugify from 'slugify';
import mongoose from 'mongoose';
import Category from '../models/Category';
import Product from '../models/Product';
import { v4 as uuid } from 'uuid';
import cloudinary from '../config/cloudinary';

export class CategoryController {
    static async createCategory(req: Request, res: Response) {
        try {
            let { nombre, descripcion, parent, attributes, image, isActive, order } = req.body;

            if (parent === "null" || parent === "" || parent === undefined) {
                parent = null;
            }

            const slug = slugify(nombre, { lower: true, strict: true });

            const existing = await Category.findOne({ slug, deletedAt: null });
            if (existing) {
                res.status(400).json({ message: "La categoría ya existe y se encuentra activa." });
                return;
            }

            if (parent !== null) {
                if (!mongoose.Types.ObjectId.isValid(parent)) {
                    res.status(400).json({ message: "El ID de la categoría padre no es válido." });
                    return;
                }
                const parentExists = await Category.findOne({ _id: parent, deletedAt: null });
                if (!parentExists) {
                    res.status(400).json({ message: "La categoría padre especificada no existe o fue eliminada." });
                    return;
                }
            }

            if (attributes && Array.isArray(attributes)) {
                for (const attr of attributes) {
                    if (!attr.name || !Array.isArray(attr.values) || attr.values.length === 0) {
                        res.status(400).json({ message: "Cada atributo debe tener un nombre y al menos un valor" });
                        return;
                    }
                }
            }

            const newCategory = new Category({
                nombre,
                descripcion,
                slug,
                parent: parent || null,
                image,
                isActive,
                order: order ? Number(order) : 0, // ✅ Corrección: Persistir el orden de prioridad
                attributes: attributes?.map(a => ({
                    name: a.name.trim(),
                    values: a.values.map((v: string) => v.trim()),
                    isVariant: a.isVariant ?? false
                }))
            });

            await newCategory.save();
            res.status(201).json({ message: "Categoría creada con éxito." });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al crear la categoría" });
        }
    }

    static async getCategories(req: Request, res: Response) {
        try {
            const categories = await Category.find({ deletedAt: null })
                .select('_id nombre slug descripcion parent attributes image order isActive createdAt updatedAt')
                .populate('parent', '_id nombre slug')
                .sort({ order: 1, createdAt: -1 });
            res.status(200).json(categories);
        } catch (error) {
            res.status(500).json({ message: 'Error al obtener las categorías' });
        }
    }

    static async getCategoryById(req: Request, res: Response) {
        try {
            const { id } = req.params;

            // ✅ Corrección: Validar formato del parámetro ID
            if (!mongoose.Types.ObjectId.isValid(id)) {
                res.status(400).json({ message: 'El ID provisto no tiene un formato válido' });
                return;
            }

            // ✅ Corrección: Añadidos 'createdAt' y 'updatedAt' al .select()
            const category = await Category.findOne({ _id: id, deletedAt: null })
                .select('_id nombre slug descripcion parent attributes image isActive createdAt updatedAt')
                .populate('parent', '_id nombre slug');

            if (!category) {
                res.status(404).json({ message: 'Categoría no encontrada o eliminada' });
                return;
            }
            res.status(200).json(category);
        } catch (error) {
            res.status(500).json({ message: 'Error al obtener la categoría' });
        }
    }

    static async getCategoryBySlug(req: Request, res: Response) {
        try {
            const { slug } = req.params;

            // ✅ Corrección: Añadidos 'createdAt' y 'updatedAt' al .select()
            const category = await Category.findOne({ slug, deletedAt: null })
                .select('_id nombre slug descripcion parent attributes image isActive createdAt updatedAt')
                .populate('parent', '_id nombre slug');

            if (!category) {
                res.status(404).json({ message: 'Categoría no encontrada' });
                return;
            }
            res.status(200).json(category);
        } catch (error) {
            res.status(500).json({ message: 'Error al obtener la categoría' });
        }
    }

    static async updateCategory(req: Request, res: Response) {
        try {
            const { id } = req.params;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                res.status(400).json({ message: 'El ID de la categoría a actualizar no es válido' });
                return;
            }

            // ✅ Corrección: Extraer 'order' del req.body
            let { nombre, descripcion, parent, attributes, image, isActive, order } = req.body;

            if (parent === "null" || parent === "" || parent === undefined) {
                parent = null;
            }

            if (parent !== null) {
                if (!mongoose.Types.ObjectId.isValid(parent)) {
                    res.status(400).json({ message: "El ID de la categoría padre no es válido" });
                    return;
                }
                if (parent === id) {
                    res.status(400).json({ message: "No se puede establecer una categoría como su propio padre" });
                    return;
                }
                if (await CategoryController.isCyclical(id, parent)) {
                    res.status(400).json({ message: "No se puede crear una relación circular de categorías" });
                    return;
                }
                const parentExists = await Category.findOne({ _id: parent, deletedAt: null });
                if (!parentExists) {
                    res.status(400).json({ message: "La categoría padre no existe o está eliminada" });
                    return;
                }
            }

            const existing = await Category.findOne({ _id: id, deletedAt: null });
            if (!existing) {
                res.status(404).json({ message: "Categoría no encontrada" });
                return;
            }

            const slug = slugify(nombre, { lower: true, strict: true });

            const existingSlug = await Category.findOne({ slug, deletedAt: null });
            if (existingSlug && existingSlug._id.toString() !== id) {
                res.status(400).json({ message: "El slug ya se encuentra en uso por otra categoría activa" });
                return;
            }

            const updated = await Category.findByIdAndUpdate(
                id,
                {
                    nombre,
                    descripcion,
                    slug,
                    parent,
                    order: order !== undefined ? Number(order) : existing.order, // ✅ Corrección: Actualizar el orden
                    attributes: attributes
                        ? attributes.map(a => ({
                            name: a.name.trim(),
                            values: a.values.map((v: string) => v.trim()),
                            isVariant: a.isVariant ?? false
                        }))
                        : existing.attributes,
                    image: image ?? existing.image,
                    isActive: isActive !== undefined ? isActive : existing.isActive
                },
                { new: true }
            );

            res.status(200).json({ message: "Categoría actualizada con éxito", data: updated });
        } catch (error) {
            res.status(500).json({ message: "Error al actualizar la categoría" });
        }
    }

    private static async isCyclical(categoryId: string, parentId: string): Promise<boolean> {
        let current: string | null = parentId;
        const visited = new Set<string>();

        while (current) {
            if (current === categoryId || visited.has(current)) return true;
            visited.add(current);
            if (!mongoose.Types.ObjectId.isValid(current)) return false;
            const cat = await Category.findOne({ _id: current, deletedAt: null });
            current = cat?.parent ? cat.parent.toString() : null;
        }
        return false;
    }

    static async deleteCategory(req: Request, res: Response) {
        try {
            const { id } = req.params;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                res.status(400).json({ message: 'El ID provisto no tiene un formato válido' });
                return;
            }

            const existingCategory = await Category.findOne({ _id: id, deletedAt: null });
            if (!existingCategory) {
                res.status(404).json({ message: 'Categoría no encontrada o ya eliminada' });
                return;
            }

            const hasSubcategories = await Category.countDocuments({ parent: id, deletedAt: null });
            if (hasSubcategories > 0) {
                res.status(400).json({ message: 'No se puede eliminar la categoría porque tiene subcategorías asociadas' });
                return;
            }

            const hasProducts = await Product.countDocuments({ categoria: id, deletedAt: null });
            if (hasProducts > 0) {
                res.status(400).json({ message: 'No se puede eliminar la categoría porque contiene productos activos vinculados' });
                return;
            }

            await Category.findByIdAndUpdate(id, { deletedAt: new Date(), isActive: false });
            res.status(200).json({ message: 'Categoría eliminada con éxito' });
        } catch (error) {
            res.status(500).json({ message: 'Error al eliminar la categoría' });
        }
    }

    static async getRootCategories(req: Request, res: Response) {
        try {
            // ✅ Corrección: Añadidos 'createdAt' y 'updatedAt' al .select()
            const rootCategories = await Category.find({ parent: null, deletedAt: null })
                .select('_id nombre slug descripcion order image createdAt updatedAt')
                .sort({ order: 1, createdAt: -1 });

            if (rootCategories.length === 0) {
                res.status(404).json({ message: 'No se encontraron categorías raíz' });
                return;
            }
            res.status(200).json(rootCategories);
        } catch (error) {
            res.status(500).json({ message: 'Error al obtener las categorías raíz' });
        }
    }

    static async getSubcategories(req: Request, res: Response) {
        try {
            const { id } = req.params;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                res.status(400).json({ message: 'El ID de la categoría base no es válido' });
                return;
            }

            const existingCategory = await Category.findOne({
                _id: id,
                deletedAt: null,
                isActive: true
            });

            if (!existingCategory) {
                res.status(404).json({ message: 'Categoría base no encontrada o inactiva' });
                return;
            }

            // ✅ Corrección: Añadidos 'createdAt' y 'updatedAt' al .select()
            const subcategories = await Category.find({
                parent: id,
                deletedAt: null,
                isActive: true
            })
                .select('_id nombre slug descripcion attributes image isActive createdAt updatedAt')
                .sort({ order: 1, createdAt: -1 });

            res.status(200).json(subcategories);
        } catch (error) {
            console.error("Error en getSubcategories:", error);
            res.status(500).json({ message: 'Error al obtener las subcategorías' });
        }
    }

    static async getAllSubcategoriesPobladas(req: Request, res: Response) {
        try {
            // ✅ Corrección: Añadidos 'createdAt' y 'updatedAt' al .select()
            const categories = await Category.find({ parent: { $ne: null }, isActive: true, deletedAt: null })
                .select('_id nombre slug descripcion parent attributes image createdAt updatedAt')
                .populate('parent', '_id nombre slug')
                .sort({ createdAt: -1 });

            res.status(200).json(categories);
        } catch (error) {
            res.status(500).json({ message: 'Error al obtener las subcategorías' });
        }
    }

    static async uploadCategoryImage(req: Request, res: Response) {
        try {
            const file = (req as any).file;
            if (!file) {
                res.status(400).json({ message: 'No file uploaded' });
                return;
            }

            const results = await cloudinary.uploader.upload(file.path, {
                folder: 'categories',
                public_id: uuid(),
                transformation: [
                    { width: 800, height: 600, crop: "limit" }
                ]
            });
            res.status(200).json({ image: results.secure_url });
        } catch (error) {
            res.status(500).json({ message: 'Error uploading file' });
        }
    }
}