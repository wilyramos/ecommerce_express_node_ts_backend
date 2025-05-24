import { Request, Response } from 'express';
import slugify from 'slugify';
import Category from '../models/Category';
import Product from '../models/Product';


export class CategoryController {
    static async createCategory(req: Request, res: Response) {
        try {
            const { nombre, descripcion } = req.body;
            const slug = slugify(nombre, { lower: true, strict: true });

            const ExistingCategory = await Category.findOne({ slug });
            if (ExistingCategory) {
                res.status(400).json({ message: "La categoria ya existe" });
                return;
            }

            const newCategory = new Category({
                nombre,
                descripcion,
                slug
            });
            await newCategory.save();
            res.status(201).json({ message: "Category created successfully" });

        } catch (error) {
            res.status(500).json({ message: 'Error al crear la categoria' });
            return;
        }
    }

    static async getCategories(req: Request, res: Response) {
        try {
            const categories = await Category.find().select('_id nombre slug descripcion');
            res.status(200).json(categories);
        } catch (error) {
            res.status(500).json({ message: 'Error al obtener las categorias' });
            return;
        }
    }
    static async getCategoryById(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const category = await Category.findById(id);
            if (!category) {
                res.status(404).json({ message: 'Categoria no encontrada' });
                return;
            }
            res.status(200).json(category);
        } catch (error) {
            res.status(500).json({ message: 'Error al obtener la categoria', error });
            return;
        }
    }

    static async getCategoryBySlug(req: Request, res: Response) {
        try {
            const { slug } = req.params;
            const category = await Category.findOne({ slug });
            if (!category) {
                res.status(404).json({ message: 'Categoria no encontrada' });
                return;
            }
            res.status(200).json(category);
        } catch (error) {
            res.status(500).json({ message: 'Error al obtener la categoria', error });
            return;
        }
    }

    static async updateCategory(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { nombre, descripcion } = req.body;
            const slug = slugify(nombre, { lower: true, strict: true });

            // Verificar si la categoria existe
            // const existingCategory = await Category.findById(id);
            // if (!existingCategory) {
            //     res.status(404).json({ message: 'Categoria no encontrada' });
            //     return;
            // }
            // Verificar si el slug ya existe
            const existingSlug = await Category.findOne({ slug });
            if (existingSlug && existingSlug._id.toString() !== id) {
                res.status(400).json({ message: 'El slug ya existe' });
                return;
            }

            const category = await Category.findByIdAndUpdate(id, { nombre, descripcion, slug }, { new: true });
            if (!category) {
                res.status(404).json({ message: 'Categoria no encontrada' });
                return;
            }
            res.status(200).json({ message: 'Categoria actualizada con exito' });
        } catch (error) {
            res.status(500).json({ message: 'Error al actualizar la categoria' });
            return;
        }
    }

    static async deleteCategory(req: Request, res: Response) {
        try {
            const { id } = req.params;

            const productWithCategory = await Product.countDocuments({ categoria: id });
            if (productWithCategory > 0) {
                res.status(400).json({ message: 'No se puede eliminar la categoria porque tiene productos asociados' });
                return;
            }
            const category = await Category.findByIdAndDelete(id);
            if (!category) {
                res.status(404).json({ message: 'Categoria no encontrada' });
                return;
            }

            res.status(200).json({ message: 'Categoria eliminada con exito' });
        } catch (error) {
            // console.error(error);
            res.status(500).json({ message: 'Error al eliminar la categoria' });
            return;
        }
    }
}