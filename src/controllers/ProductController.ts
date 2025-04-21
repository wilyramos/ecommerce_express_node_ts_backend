import { Request, Response } from 'express';
import Category from '../models/Category';
import Product from '../models/Product';




export class ProductController {

    static async createProduct(req: Request, res: Response) {
        try {
            const { nombre, descripcion, precio, imagenes, categoria, stock, sku } = req.body;

            // validate category exists
            const existingCategory = await Category.findById(categoria);
            if (!existingCategory) {
                res.status(400).json({ message: 'La categoría no existe' });
                return;
            }

            const newProduct = {
                nombre,
                descripcion,
                precio,
                imagenes: imagenes || [], // default to empty array if not provided
                categoria,
                stock,
                sku: sku
            };

            const product = new Product(newProduct);
            await product.save();
            res.status(201).json({ message: 'Product created successfully', product });

        } catch (error) {
            // console.error('Error creating product:', error);
            res.status(500).json({ message: 'Error creating product' });
            return;
        }
    }

    static async getProducts(req: Request, res: Response) {
        try {
            const { page = 1, limit = 10 } = req.query;
            const skip = (Number(page) - 1) * Number(limit);
            const products = await Product.find()
                .populate('categoria', 'nombre slug')
                .skip(skip)
                .limit(Number(limit))
                .sort({ createdAt: -1 }); // sort by createdAt in descending order

            const totalProducts = await Product.countDocuments();
            res.status(200).json({
                products,
                totalPages: Math.ceil(totalProducts / Number(limit)),
                currentPage: Number(page),
                totalProducts
            });
            
        } catch (error) {
            res.status(500).json({ message: 'Error fetching products' });
            return;
        }
    }

    static async getProductById(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const product = await Product.findById(id).populate('categoria', 'nombre slug');
            if (!product) {
                res.status(404).json({ message: 'Product not found' });
                return;
            }
            res.status(200).json(product);
        } catch (error) {
            res.status(500).json({ message: 'Error obteniendo el producto', error });
            return;
        }
    }

    static async updateProduct(req: Request, res: Response) {
        try {
            const { nombre, descripcion, precio, imagenes, categoria, stock, sku } = req.body;
            const productId = req.params.id;

            const existingProduct = await Product.findById(productId);
            if (!existingProduct) {
                res.status(404).json({ message: 'Product not found' });
                return;
            }

            if (categoria) {
                const existingCategory = await Category.findById(categoria);
                if (!existingCategory) {
                    res.status(400).json({ message: 'La categoría no existe' });
                    return;
                }
            }

            existingProduct.nombre = nombre || existingProduct.nombre;
            existingProduct.descripcion = descripcion || existingProduct.descripcion;
            existingProduct.precio = precio || existingProduct.precio;
            existingProduct.imagenes = imagenes || existingProduct.imagenes;
            existingProduct.categoria = categoria || existingProduct.categoria;
            existingProduct.stock = stock || existingProduct.stock;
            existingProduct.sku = sku || existingProduct.sku;

            const updatedProduct = await existingProduct.save();
            res.status(200).json({ message: 'Producto actualizado correctamente', product: updatedProduct });
        } catch (error) {
            res.status(500).json({ message: 'Error updating product', error });
            return;
        }
    }

    static async deleteProduct(req: Request, res: Response) {
        try {
            const productId = req.params.id;
            const product = await Product.findById(productId);
            if (!product) {
                res.status(404).json({ message: 'Producto no encontrado' });
                return;
            }
            await product.deleteOne();
            res.status(200).json({ message: 'Producto eliminado correctamente' });
        } catch (error) {
            res.status(500).json({ message: 'Error eliminando el producto', error });
            return;
        }
    }

    static async getProductBySlug(req: Request, res: Response) {
        // TODO: Implementar la lógica para obtener un producto por su slug,
        // Tener en cuetna que se debe añadir en los modelos el slug
        // y que el slug debe ser único para cada producto.
    }

    static async uploadImage(req: Request, res: Response) {
        console.log('Uploading image...');
    }

    static async getProductsByCategory(req: Request, res: Response) {
        try {
            const { categoryId  } = req.params;
            console.log('Category ID:', categoryId);
            const category = await Category.findById(categoryId);
            if (!category) {
                res.status(404).json({ message: 'Category no encontrada' });
                return;
            }
            const products = await Product.find({ categoria: categoryId }).populate('categoria', 'nombre slug');
            res.status(200).json(products);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching products by category', error });
            return;
        }
    }
}