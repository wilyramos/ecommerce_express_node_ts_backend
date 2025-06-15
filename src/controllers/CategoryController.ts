import { Request, Response } from 'express';
import slugify from 'slugify';
import Category from '../models/Category';
import Product from '../models/Product';


export class CategoryController {
    static async createCategory(req: Request, res: Response) {
        try {
            const { nombre, descripcion, parent, attributes } = req.body;
            const slug = slugify(nombre, { lower: true, strict: true });

            const ExistingCategory = await Category.findOne({ slug });
            if (ExistingCategory) {
                res.status(400).json({ message: "La categoria ya existe" });
                return;
            }

            // Verificar que el parent exista si se proporciona
            if (parent) {
                const existingParent = await Category.findById(parent);
                if (!existingParent) {
                    res.status(400).json({ message: "La categoria padre no existe" });
                    return;
                }
            }

            // Validar que los atributos sean válidos
            
            if (attributes) {
                if (!Array.isArray(attributes) || attributes.length === 0) {
                    res.status(400).json({ message: "Los atributos deben ser un array no vacío" });
                    return;
                }

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
                parent: parent || null, // Si no se proporciona parent, se establece como null,
                attributes
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
            const categories = await Category.find().select('_id nombre slug descripcion parent')
                .populate('parent', '_id nombre slug')
                .sort({ createdAt: -1 });
            // console.log('Categories:', categories);
            res.status(200).json(categories);
        } catch (error) {
            res.status(500).json({ message: 'Error al obtener las categorias' });
            return;
        }
    }
    static async getCategoryById(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const category = await Category.findById(id)
                .select('_id nombre slug descripcion parent attributes')
                .populate('parent', '_id nombre slug');
            if (!category) {
                res.status(404).json({ message: 'Categoria no encontrada' });
                return;
            }

            // console.log('Category:', category);
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
            const { nombre, descripcion, parent, attributes } = req.body;

            console.log('body', req.body);

            const slug = slugify(nombre, { lower: true, strict: true });

            // Verificar si la categoría existe
            const existingCategory = await Category.findById(id);
            if (!existingCategory) {
                res.status(404).json({ message: "Categoría no encontrada" });
                return;
            }
            // Verificar si el slug ya existe
            const existingSlug = await Category.findOne({ slug });
            if (existingSlug && existingSlug._id.toString() !== id) {
                res.status(400).json({ message: 'El slug ya existe' });
                return;
            }
            // Verificar que el parent exista si se proporciona
            if (parent) {
                if (parent === id) {
                    res.status(400).json({ message: 'No se puede establecer la categoria como su propia categoria padre' });
                    return;
                }
                const existingParent = await Category.findById(parent);
                if (!existingParent) {
                    res.status(400).json({ message: "La categoria padre no existe" });
                    return;
                }
            }

            // Validar que los atributos sean válidos
            if (attributes) {
                if (!Array.isArray(attributes) || attributes.length === 0) {
                    res.status(400).json({ message: "Los atributos deben ser un array no vacío" });
                    return;
                }

                for (const attr of attributes) {
                    if (!attr.name || !Array.isArray(attr.values) || attr.values.length === 0) {
                        res.status(400).json({ message: "Cada atributo debe tener un nombre y al menos un valor" });
                        return;
                    }
                }
            }

            // Actualizar la categoria
            const updatedCategory = await Category.findByIdAndUpdate(id, {
                nombre,
                descripcion,
                slug,
                parent: parent ? parent : null, // Si no se proporciona parent, se establece como null
                attributes
            }, { new: true });

            if (!updatedCategory) {
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

            // verificar si la categoria existe
            const existingCategory = await Category.findById(id);
            if (!existingCategory) {
                res.status(404).json({ message: 'Categoria no encontrada' });
                return;
            }


            // Verificar si la categoria tiene productos asociados
            if (productWithCategory > 0) {
                res.status(400).json({ message: 'No se puede eliminar la categoria porque tiene productos asociados' });
                return;
            }


            // Verificar si la categoria tiene subcategorias
            const subcategories = await Category.countDocuments({ parent: id });
            if (subcategories > 0) {
                res.status(400).json({ message: 'No se puede eliminar la categoria porque tiene subcategorias asociadas' });
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

    // Traer solo las categorias raiz
    static async getRootCategories(req: Request, res: Response) {
        try {

            const rootCategories = await Category.find({ parent: null })
                .select('_id nombre slug descripcion')
                .sort({ createdAt: -1 });

            if (rootCategories.length === 0) {
                res.status(404).json({ message: 'No se encontraron categorias raiz' });
                return;
            }

            res.status(200).json(rootCategories);


        } catch (error) {
            res.status(500).json({ message: 'Error al obtener las categorias raiz' });
            return;
        }
    }

    // Traer las subcategorias de una categoria
    static async getSubcategories(req: Request, res: Response) {
        try {
            const { id } = req.params;

            // Verificar si la categoria existe
            const existingCategory = await Category.findById(id);
            if (!existingCategory) {
                res.status(404).json({ message: 'Categoria no encontrada' });
                return;
            }

            const subcategories = await Category.find({ parent: id })
                .select('_id nombre slug descripcion')
                .sort({ createdAt: -1 });

            if (subcategories.length === 0) {
                res.status(404).json({ message: 'No se encontraron subcategorias' });
                return;
            }

            res.status(200).json(subcategories);
        } catch (error) {
            res.status(500).json({ message: 'Error al obtener las subcategorias' });
            return;
        }
    }

    // Traer todas las subcategorias pobladas
    static async getAllSubcategories(req: Request, res: Response) {
        try {
            const categories = await Category.find({ parent: { $ne: null } })
                .select('_id nombre slug descripcion parent')
                .populate('parent', '_id nombre slug')
                .sort({ createdAt: -1 });

            if (categories.length === 0) {
                res.status(404).json({ message: 'No se encontraron subcategorias' });
                return;
            }

            res.status(200).json(categories);
        } catch (error) {
            res.status(500).json({ message: 'Error al obtener las subcategorias', error });
            return;
        }
    }

}