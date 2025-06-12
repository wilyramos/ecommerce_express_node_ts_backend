import { Request, Response } from 'express';
import Category from '../models/Category';
import Product from '../models/Product';
import formidable from 'formidable';
// import cloudinary from 'cloudinary';
import { v4 as uuid } from 'uuid';
import cloudinary from '../config/cloudinary';



export class ProductController {

    static async createProduct(req: Request, res: Response) {
        try {
            const { nombre, descripcion, precio, imagenes, categoria, stock, sku, barcode, brand, color, variantes,
                esDestacado, esNuevo

            } = req.body;

            console.log('Creating product with data:', req.body);

            // validate category exists
            const selectedCategory = await Category.findById(categoria);
            if (!selectedCategory) {
                res.status(400).json({ message: 'La categoría no existe' });
                return;
            }

            // Check if the category has children
            const hasChildren = await Category.exists({ parent: categoria });
            if (hasChildren) {
                res.status(400).json({ message: 'No se puede crear un producto en una categoría que tiene subcategorías' });
                return;
            }

            // validate images length
            if (imagenes && imagenes.length > 5) {
                res.status(400).json({ message: 'No se pueden subir más de 5 imágenes' });
                return;
            }

            // Validate variant if provided
            if (variantes && !Array.isArray(variantes)) {
                res.status(400).json({ message: 'Variantes deben ser un array' });
                return;
            }

            const newProduct = {
                nombre,
                descripcion,
                precio: Number(precio),
                imagenes: imagenes || [],
                categoria,
                stock: Number(stock),
                sku: sku ? sku : undefined,
                barcode: barcode ? barcode : undefined,
                brand: brand ? brand : undefined,
                color: color ? color : undefined,
                variantes: variantes || [],
                esDestacado: esDestacado ? esDestacado : false,
                esNuevo: esNuevo ? esNuevo : false,
            };

            const product = new Product(newProduct);
            await product.save();
            res.status(201).json({ message: 'Product created successfully' });

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

            // obtener solo el nombre de la categoria
            const products = await Product.find()

                .skip(skip)
                .limit(Number(limit))
                .sort({ createdAt: -1 });

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


    // Get product with pagination
    static async getNewProducts(req: Request, res: Response) {
        try {
            const { page = '1', limit = '10' } = req.query as {
                page?: string;
                limit?: string;
            };

            const pageNum = parseInt(page, 10);
            const limitNum = parseInt(limit, 10);
            const skip = (pageNum - 1) * limitNum;

            // Obtener solo los productos nuevos
            const products = await Product.find({ esNuevo: true })
                .skip(skip)
                .limit(limitNum)
                .sort({ createdAt: -1 });

            const totalProducts = await Product.countDocuments({ esNuevo: true });

            res.status(200).json({
                products,
                totalPages: Math.ceil(totalProducts / limitNum),
                currentPage: pageNum,
                totalProducts
            });

        } catch (error) {
            res.status(500).json({ message: 'Error fetching new products' });
        }
    }

    static async getProductsByFilter(req: Request, res: Response) {
        try {
            const {
                page = '1',
                limit = '10',
                category,
                priceRange,
                brand,
                color,
                sort,
                compatibilidad
            } = req.query as {
                page?: string;
                limit?: string;
                category?: string;
                priceRange?: string | string[];
                brand?: string;
                color?: string;
                sort?: string;
                compatibilidad?: string;
            };

            // console.log('Filter Params:', compatibilidad, category, priceRange, brand, color, sort);

            const pageNum = parseInt(page, 10);
            const limitNum = parseInt(limit, 10);
            const skip = (pageNum - 1) * limitNum;

            const filter: Record<string, any> = {};

            // Buscar el ID de la categoría si se provee el slug
            if (category) {
                const categoryDoc = await Category.findOne({ slug: category });
                if (categoryDoc) {
                    filter.categoria = categoryDoc._id;
                }
            }

            // Filtrado por rango de precio
            const priceStr = Array.isArray(priceRange) ? priceRange[0] : priceRange;
            if (priceStr) {
                const [minStr, maxStr] = priceStr.split('-');
                const min = Number(minStr);
                const max = Number(maxStr);
                if (isNaN(min) || isNaN(max) || min < 0 || max < 0 || min > max) {
                    res.status(400).json({ message: 'Rango de precios inválido' });
                    return;
                }
                filter.precio = { $gte: min, $lte: max };
            }

            // Filtrado por marca
            if (brand) {
                filter.brand = { $regex: new RegExp(brand, 'i') };
            }

            // Variantes y campos generales (color y compatibilidad)
            const orConditions: any[] = [];

            if (color) {
                // Coincidencia en campo general `color`
                orConditions.push({ color: { $regex: new RegExp(color, 'i') } });

                // Coincidencia en variantes
                orConditions.push({
                    variantes: {
                        $elemMatch: {
                            opciones: {
                                $elemMatch: {
                                    nombre: { $regex: /^color$/i },
                                    valores: { $regex: new RegExp(color, 'i') }
                                }
                            }
                        }
                    }
                });
            }

            if (compatibilidad) {
                orConditions.push({
                    variantes: {
                        $elemMatch: {
                            opciones: {
                                $elemMatch: {
                                    nombre: { $regex: /^compatibilidad$/i },
                                    valores: { $regex: new RegExp(compatibilidad, 'i') }
                                }
                            }
                        }
                    }
                });
            }

            if (orConditions.length > 0) {
                filter.$or = orConditions;
            }

            // Ordenamiento
            let sortOptions: Record<string, 1 | -1> = {};
            switch (sort) {
                case 'price-asc':
                    sortOptions = { precio: 1 };
                    break;
                case 'price-desc':
                    sortOptions = { precio: -1 };
                    break;
                case 'name-asc':
                    sortOptions = { nombre: 1 };
                    break;
                case 'name-desc':
                    sortOptions = { nombre: -1 };
                    break;
                default:
                    sortOptions = { stock: -1, createdAt: -1 };
            }

            // Consulta principal y traer solo los productos activos
            filter.isActive = true; // Solo productos activos
            const [products, totalProducts] = await Promise.all([
                Product.find(filter)
                    .skip(skip)
                    .limit(limitNum)
                    .sort(sortOptions),

                Product.countDocuments(filter)
            ]);

            res.status(200).json({
                products,
                totalPages: Math.ceil(totalProducts / limitNum),
                currentPage: pageNum,
                totalProducts
            });

        } catch (error) {
            // console.error('Error fetching products by filter:', error);
            res.status(500).json({ message: 'Error fetching products by filter' });
            return;
        }
    }

    static async searchProducts(req: Request, res: Response) {
        try {
            const { query } = req.query;
            const pageNum = parseInt(req.query.page as string, 10) || 1;
            const limitNum = parseInt(req.query.limit as string, 10) || 10;

            const searchText = query?.toString().trim() || "";

            const searchRegex = new RegExp(searchText, "i"); // 'i' = insensible a mayúsculas/minúsculas

            const filter = {
                $or: [
                    { nombre: { $regex: searchRegex } },
                    { descripcion: { $regex: searchRegex } },

                ]
            };

            const products = await Product.find(filter)
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum);

            const totalProducts = await Product.countDocuments(filter);

            if (products.length === 0) {
                res.status(404).json({ message: 'No se encontraron productos' });
                return;
            }

            res.status(200).json({
                products,
                totalPages: Math.ceil(totalProducts / limitNum),
                currentPage: pageNum,
                totalProducts
            });

        } catch (error) {
            console.error('Error searching products:', error);
            res.status(500).json({ message: 'Error al buscar productos' });
        }
    }

    static async mainSearchProducts(req: Request, res: Response) {
        try {

            const { query, page, limit } = req.query;
            const pageNum = parseInt(page as string, 10) || 1;
            const limitNum = parseInt(limit as string, 10) || 10;
            const searchText = query?.toString().trim() || "";

            const searchRegex = new RegExp(searchText, "i"); // 'i' = insensible a mayúsculas/minúsculas

            const filter = {
                $or: [
                    { nombre: { $regex: searchRegex } },
                    { descripcion: { $regex: searchRegex } },
                ]
            };

            const products = await Product.find(filter)
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum);

            const totalProducts = await Product.countDocuments(filter);

            if (products.length === 0) {
                res.status(404).json({ message: 'No se encontraron productos' });
                return;
            }

            res.status(200).json({
                products,
                totalPages: Math.ceil(totalProducts / limitNum),
                currentPage: pageNum,
                totalProducts
            });

        } catch (error) {
            //    console.error('Error en la búsqueda principal de productos:', error);
            res.status(500).json({ message: 'Error en la búsqueda principal de productos' });
        }
    }

    static async getProductById(req: Request, res: Response) {
        try {
            const { id } = req.params;
            // populate category to get the name and slug
            const product = await Product.findById(id)
                // .populate('categoria', 'nombre slug')
                .lean()
            // .populate('variantes.opciones.valores', 'nombre slug');
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
            const { nombre, descripcion, precio, imagenes, categoria, stock, sku, variantes, esDestacado, esNuevo } = req.body;
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
            // validate images length
            if (imagenes && imagenes.length > 5) {
                res.status(400).json({ message: 'No se pueden subir más de 5 imágenes' });
                return;
            }

            // Validate variant if provided // TODO: MEJORAR LA VALIDACIÓN DE VARIANTES
            if (variantes && !Array.isArray(variantes)) {
                res.status(400).json({ message: 'Las variantes deben ser un array' });
                return;
            }

            existingProduct.nombre = nombre || existingProduct.nombre;
            existingProduct.descripcion = descripcion || existingProduct.descripcion;
            if (precio != null) existingProduct.precio = precio;
            existingProduct.imagenes = imagenes || existingProduct.imagenes;
            existingProduct.categoria = categoria || existingProduct.categoria;
            if (stock != null) existingProduct.stock = stock;

            existingProduct.sku = sku || existingProduct.sku;
            existingProduct.barcode = req.body.barcode || existingProduct.barcode;
            existingProduct.brand = req.body.brand || existingProduct.brand;
            existingProduct.color = req.body.color || existingProduct.color;
            existingProduct.variantes = variantes || existingProduct.variantes;
            existingProduct.esDestacado = esDestacado !== undefined ? esDestacado : existingProduct.esDestacado;
            existingProduct.esNuevo = esNuevo !== undefined ? esNuevo : existingProduct.esNuevo;

            await existingProduct.save();
            res.status(200).json({ message: 'Producto actualizado correctamente' });
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
            res.status(500).json({ message: 'Error eliminando el producto' });
            return;
        }
    }

    static async getProductBySlug(req: Request, res: Response) {
        // TODO: Implementar la lógica para obtener un producto por su slug,
        // Tener en cuetna que se debe añadir en los modelos el slug
        // y que el slug debe ser único para cada producto.
    }

    static async getProductsByCategory(req: Request, res: Response) {
        try {
            const { categoryId } = req.params;
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

    static async uploadImagesToProduct(req: Request, res: Response) {
        const form = formidable({
            multiples: true  // Permite recibir varios archivos
        }); //

        form.parse(req, async (error, fields, files) => {
            if (error) {
                console.error("Error al procesar los archivos:", error);
                res.status(400).json({ message: 'Error al procesar los archivos' });
                return;
            }

            // Verifica si se reciben las imágenes
            if (!files.images) {
                res.status(400).json({ message: 'No se han recibido imágenes' });
                return;
            }

            // images es un array si se sube una sola imagen o un objeto si se suben varias
            // The key 'images' is used in the form data
            const images = Array.isArray(files.images) ? files.images : [files.images];

            if (images.length > 5) {
                res.status(400).json({ message: 'No se pueden subir más de 5 imágenes' });
                return;
            }

            try {
                const imageUrls = [];
                // Subir las imágenes a Cloudinary
                const uploadPromises = images.map((image) => {
                    return cloudinary.uploader.upload(image.filepath, {
                        public_id: uuid(),
                        folder: 'products',
                    });
                });

                // Esperar que todas las imágenes se suban
                const results = await Promise.all(uploadPromises);

                // Extraer las URLs de las imágenes subidas
                results.forEach(result => {
                    imageUrls.push(result.secure_url);
                });

                // Obtener el lugar por ID y actualizar sus imágenes
                const { id } = req.params;

                // Add images o mantener las imágenes existentes
                const updatedProduct = await Product.findByIdAndUpdate(
                    id,
                    { $addToSet: { imagenes: { $each: imageUrls } } }, // Añadir imágenes sin duplicados
                    { new: true } // Devuelve el documento actualizado
                );

                // verificar si el producto ya tiene 5 imágenes
                if (updatedProduct && updatedProduct.imagenes.length > 5) {
                    // Eliminar la imagen más antigua
                    updatedProduct.imagenes.shift(); // Elimina la primera imagen (la más antigua)
                    await updatedProduct.save(); // Guarda los cambios
                }

                if (!updatedProduct) {
                    res.status(404).json({ message: 'Producto no encontrado' });
                    return;
                }

                res.status(200).json({ message: 'Imágenes subidas correctamente', images: imageUrls });

            } catch (error) {
                // console.error("Error al subir las imágenes:", error);
                res.status(500).json({ message: 'Error al subir las imágenes' });
                return;
            }
        });
    };

    static async uploadImageCloudinary(req: Request, res: Response) {

        const form = formidable({ multiples: true }); // Allow multiple files
        form.parse(req, async (error, fields, files) => {
            if (error) {
                console.error("Error al procesar los archivos:", error);
                res.status(400).json({ message: 'Error al procesar los archivos' });
                return;
            }

            // Verifica si se reciben las imágenes
            if (!files.images) {
                res.status(400).json({ message: 'No se han recibido imágenes' });
                return;
            }

            const images = Array.isArray(files.images) ? files.images : [files.images];

            if (images.length > 5) {
                res.status(400).json({ message: 'No se pueden subir más de 5 imágenes' });
                return;
            }

            try {
                const imageUrls = [];
                const uploadPromises = images.map((image) => {
                    return cloudinary.uploader.upload(image.filepath, {
                        public_id: uuid(),
                        folder: 'products',
                    });
                });

                const results = await Promise.all(uploadPromises);

                results.forEach(result => {
                    imageUrls.push(result.secure_url);
                });

                res.status(200).json({ images: imageUrls });

            } catch (error) {
                console.error("Error al subir las imágenes:", error);
                res.status(500).json({ message: 'Error al subir las imágenes' });
                return;
            }
        });

    }

    static async updateProductStatus(req: Request, res: Response) {
        const { id } = req.params;
        const { isActive } = req.body;

        try {
            const product = await Product.findById(id);
            if (!product) {
                res.status(404).json({ message: 'Producto no encontrado' });
                return;
            }

            product.isActive = isActive;
            await product.save();

            res.status(200).json({ message: 'Estado del producto actualizado correctamente' });
        } catch (error) {
            // console.error("Error al actualizar el estado del producto:", error);
            res.status(500).json({ message: 'Error al actualizar el estado del producto' });
        }
    }

    // Traer productos relacionados de otras categorías
    static async getProductsRelated(req: Request, res: Response) {
        const { id } = req.params;
        try {
            const product = await Product.findById(id);
            if (!product) {
                res.status(404).json({ message: 'Producto no encontrado' });
                return;
            }

            // Obtener productos recomendados de la misma categoría
            const recommendedProducts = await Product.find({
                categoria: product.categoria, // Mismo categoría
                isActive: true, // Solo productos activos
                stock: { $gt: 0 }, // Solo productos con stock disponible
            })
                .limit(4) // Limitar a 4 productos recomendados
                .sort({ createdAt: -1 }); // Ordenar por fecha de creación

            res.status(200).json(recommendedProducts);
        } catch (error) {
            // console.error("Error al obtener productos recomendados:", error);
            res.status(500).json({ message: 'Error al obtener productos recomendados' });
        }
    }
}