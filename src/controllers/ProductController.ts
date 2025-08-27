import { Request, Response } from 'express';
import Category from '../models/Category';
import Product from '../models/Product';
import formidable from 'formidable';
// import cloudinary from 'cloudinary';
import { v4 as uuid } from 'uuid';
import cloudinary from '../config/cloudinary';
import slugify from 'slugify';
import { generateUniqueSlug } from '../utils/slug';



export class ProductController {

    static async createProduct(req: Request, res: Response) {
        try {
            const {
                nombre,
                descripcion,
                precio,
                costo,
                imagenes,
                categoria,
                stock,
                sku,
                barcode,
                esDestacado,
                esNuevo,
                isActive,
                atributos
            } = req.body;
            // validate category exists y no tiene subcategorías
            const [selectedCategory, hasChildren] = await Promise.all([
                Category.findById(categoria),
                Category.exists({ parent: categoria }),
            ]);

            if (!selectedCategory) {
                res.status(400).json({ message: 'La categoría no existe' });
                return;
            }

            if (hasChildren) {
                res.status(400).json({
                    message: 'No se puede crear un producto en una categoría que tiene subcategorías',
                });
                return;
            }

            // validate images length
            if (imagenes && imagenes.length > 5) {
                res.status(400).json({ message: 'No se pueden subir más de 5 imágenes' });
                return;
            }

            // Validate atributos if provided
            if (atributos && typeof atributos !== 'object') {
                res.status(400).json({ message: 'Atributos deben ser un objeto' });
                return;
            }

            const slug = await generateUniqueSlug(nombre);

            const newProduct = {
                nombre,
                slug,
                descripcion,
                precio: Number(precio),
                costo: Number(costo),
                imagenes: imagenes,
                categoria,
                stock: Number(stock),
                sku: sku,
                barcode: barcode,
                esDestacado: esDestacado,
                esNuevo: esNuevo,
                isActive: isActive,
                atributos: atributos,
            };

            // console.log(newProduct);

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

            const { page = "1", limit = "10", query } = req.query;

            const currentPage = Math.max(parseInt(page as string) || 1, 1);
            const pageSize = Math.max(parseInt(limit as string) || 10, 1);
            const skip = (currentPage - 1) * pageSize;

            let filter = {};

            if (query && typeof query === "string" && query.trim() !== "") {
                const searchRegex = new RegExp(query.trim(), "i");
                filter = {
                    $or: [
                        { nombre: { $regex: searchRegex } },
                        { descripcion: { $regex: searchRegex } },
                        { sku: { $regex: searchRegex } },
                        { barcode: { $regex: searchRegex } },
                    ],
                };
            }

            const [products, totalProducts] = await Promise.all([
                Product.find(filter)
                    .skip(skip)
                    .limit(pageSize)
                    .sort({ updatedAt: -1 }), // sort by latest update
                // .populate("categoria", "nombre slug"),
                Product.countDocuments(filter),
            ]);

            res.status(200).json({
                products,
                totalPages: Math.ceil(totalProducts / pageSize),
                currentPage: currentPage,
                totalProducts
            });

        } catch (error) {
            res.status(500).json({ message: 'Error fetching products' });
            return;
        }
    }

    static async searchListProducts(req: Request, res: Response) {

        const { q } = req.query;

        const limit = 10;
        if (!q || typeof q !== "string") {
            res.status(400).json({ message: 'Invalid query' });
            return;
        }
        
        try {
            const products = await Product.find({
                $or: [
                    { nombre: { $regex: q, $options: "i" } },
                    { descripcion: { $regex: q, $options: "i" } },
                    { sku: { $regex: q, $options: "i" } },
                    { barcode: { $regex: q, $options: "i" } },
                ]
            }).limit(limit);

            res.status(200).json(products);
        } catch (error) {
            res.status(500).json({ message: 'Error searching products' });
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

            const products = await Product.find({ esNuevo: true })
                .skip(skip)
                .limit(limitNum)
                .sort({ createdAt: -1 })
                .populate('categoria', 'nombre slug');

            const totalProducts = await Product.countDocuments({ esNuevo: true });

            res.status(200).json({
                products,
                totalPages: Math.ceil(totalProducts / limitNum),
                currentPage: pageNum,
                totalProducts
            });

        } catch (error) {
            res.status(500).json({ message: 'Error fetching new products' });
            return;
        }
    }

    static async getProductsByFilter(req: Request, res: Response) {
        try {
            const {
                page = '1',
                limit = '10',
                category,
                priceRange,
                sort,
                query
            } = req.query as {
                page?: string;
                limit?: string;
                category?: string;
                priceRange?: string | string[];
                sort?: string;
                query?: string;
                [key: string]: string | string[] | undefined;
            };

            const pageNum = parseInt(page, 10);
            const limitNum = parseInt(limit, 10);
            const skip = (pageNum - 1) * limitNum;

            const filter: Record<string, any> = {};

            // --- Categoría (por slug)
            if (category) {
                const categoryDoc = await Category.findOne({ slug: category });
                if (categoryDoc) {
                    filter.categoria = categoryDoc._id;
                }
            }

            // --- Rango de precios
            const priceStr = Array.isArray(priceRange) ? priceRange[0] : priceRange;
            if (priceStr) {
                const [minStr, maxStr] = priceStr.split('-');
                const min = Number(minStr);
                const max = Number(maxStr);
                if (isNaN(min) || isNaN(max) || min < 0 || max < 0 || min > max) {
                    res.status(400).json({ message: 'Invalid price range' });
                    return;
                }
                filter.precio = { $gte: min, $lte: max };
            }

            // --- Atributos dinámicos: atributos[Tamaño]=250ml, atributos[Material]=Aluminio, etc.
            for (const key in req.query) {
                if (key.startsWith("atributos[") && key.endsWith("]")) {
                    const attrKey = key.slice(10, -1);
                    const value = req.query[key];

                    if (typeof value === "string") {
                        const valuesArray = value.split(",");
                        filter[`atributos.${attrKey}`] = {
                            $in: valuesArray.map((v) => new RegExp(v, "i")),
                        };
                    } else if (Array.isArray(value)) {
                        filter[`atributos.${attrKey}`] = {
                            $in: value.map((v) => new RegExp(String(v), "i")),
                        };
                    }
                }
            }




            // --- Color como $or
            const orConditions: any[] = [];



            if (orConditions.length > 0) {
                filter.$or = orConditions;
            }

            // --- Texto de búsqueda general
            if (query) {
                const regex = new RegExp(query, 'i');
                filter.$or = [
                    ...(filter.$or || []),
                    { nombre: regex },
                    { descripcion: regex },
                    { [`atributos.Marca`]: regex },
                    {
                        variantes: {
                            $elemMatch: {
                                opciones: {
                                    $elemMatch: {
                                        valores: regex
                                    }
                                }
                            }
                        }
                    }
                ];
            }

            // --- Solo productos activos
            filter.isActive = true;

            // --- Ordenamiento
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

            // --- Consulta a la base de datos
            const [products, totalProducts] = await Promise.all([
                Product.find(filter)
                    .skip(skip)
                    .limit(limitNum)
                    .sort(sortOptions)
                    .populate('categoria', 'nombre slug'),
                Product.countDocuments(filter)
            ]);

            res.status(200).json({
                products,
                totalPages: Math.ceil(totalProducts / limitNum),
                currentPage: pageNum,
                totalProducts
            });
            return;

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
                .limit(limitNum)
                .populate('categoria', 'nombre slug')
                ;

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
                .limit(limitNum)
                .populate('categoria', 'nombre slug');

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
                .select('+costo')
                .populate('categoria', 'nombre slug');

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

    static async getProductBySlug(req: Request, res: Response) {
        try {
            const { slug } = req.params;
            const product = await Product.findOne({ slug }).populate('categoria', 'nombre slug');


            if (!product) {
                res.status(404).json({ message: 'Product not found' });
                return;
            }
            res.status(200).json(product);
        } catch (error) {

        }
    }

    static async updateProduct(req: Request, res: Response) {
        try {
            const {
                nombre,
                descripcion,
                precio,
                costo,
                imagenes,
                categoria,
                stock,
                sku,
                esDestacado,
                esNuevo,
                isActive,
                atributos,
                barcode,
            } = req.body;

            const productId = req.params.id;
            const existingProduct = await Product.findById(productId);
            if (!existingProduct) {
                res.status(404).json({ message: 'Producto no encontrado' });
                return;
            }

            // Validar si la categoría cambió
            let categoriaCambio = false;
            if (categoria && categoria !== existingProduct.categoria.toString()) {
                const selectedCategory = await Category.findById(categoria);
                if (!selectedCategory) {
                    res.status(400).json({ message: 'La categoría no existe' });
                    return;
                }

                // Validar que no tenga subcategorías
                const hasChildren = await Category.exists({ parent: categoria });
                if (hasChildren) {
                    res.status(400).json({ message: 'No se puede cambiar a una categoría que tiene subcategorías' });
                    return;
                }

                categoriaCambio = true;
                existingProduct.categoria = categoria;
            }


            // Validar atributos si se proporcionan
            if (atributos && typeof atributos !== 'object') {
                res.status(400).json({ message: 'Los atributos deben ser un objeto' });
                return;
            }

            // Si cambió la categoría, limpiar atributos y asignar los nuevos (si se proporcionan)
            if (categoriaCambio) {
                existingProduct.atributos = atributos || {};
            } else if (atributos) {
                // Si no cambió la categoría pero se envían nuevos atributos, se actualizan
                existingProduct.atributos = atributos;
            }

            // validate images length
            if (imagenes && imagenes.length > 5) {
                res.status(400).json({ message: 'No se pueden subir más de 5 imágenes' });
                return;
            }

            // Validate Slug
            const slug = slugify(nombre, { lower: true, strict: true });
            if (slug !== existingProduct.slug) {
                const existingSlug = await Product.findOne({ slug });
                if (existingSlug) {
                    res.status(400).json({ message: 'Ya existe un producto con ese slug' });
                    return;
                }
            }

            existingProduct.slug = slug;

            // Asignar valores
            existingProduct.nombre = nombre || existingProduct.nombre;
            existingProduct.descripcion = descripcion || existingProduct.descripcion;
            if (precio != null) existingProduct.precio = precio;
            if (costo != null) existingProduct.costo = costo;
            if (imagenes) existingProduct.imagenes = imagenes;
            if (stock != null) existingProduct.stock = stock;
            existingProduct.sku = sku || existingProduct.sku;
            existingProduct.barcode = barcode || existingProduct.barcode;
            existingProduct.esDestacado = esDestacado !== undefined ? esDestacado : existingProduct.esDestacado;
            existingProduct.esNuevo = esNuevo !== undefined ? esNuevo : existingProduct.esNuevo;
            existingProduct.isActive = isActive !== undefined ? isActive : existingProduct.isActive;



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

    static async getProductsByCategory(req: Request, res: Response) {
        try {
            const { categoryId } = req.params;
            const category = await Category.findById(categoryId)
                .select('nombre slug')
                .lean(); // Use lean() to return a plain JavaScript object


            if (!category) {
                res.status(404).json({ message: 'Category no encontrada' });
                return;
            }
            const products = await Product.find({ categoria: categoryId })
                .populate('categoria', 'nombre slug')
                .lean(); // Use lean() to return plain JavaScript objects
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

            res.status(200).json({ message: `Estado del producto actualizado correctamente a ${isActive ? 'activo' : 'inactivo'}` });
        } catch (error) {
            // console.error("Error al actualizar el estado del producto:", error);
            res.status(500).json({ message: 'Error al actualizar el estado del producto' });
            return;
        }
    }

    // Traer productos relacionados de otras categorías
    static async getProductsRelated(req: Request, res: Response) {
        const { slug } = req.params;
        try {
            const product = await Product.findOne({ slug })
                .populate('categoria', 'nombre slug'); // Población de la categoría
            if (!product) {
                res.status(404).json({ message: 'Producto no encontrado' });
                return;
            }

            // Obtener productos recomendados de la misma categoría, menos el producto actual
            const recommendedProducts = await Product.find({
                categoria: product.categoria._id,
                _id: { $ne: product._id } // Excluir el producto actual
            })
                .limit(4) // Limitar a 4 productos recomendados
                .populate('categoria', 'nombre slug') // Población de la categoría
                .sort({ createdAt: -1 }); // Ordenar por fecha de creación


            res.status(200).json(recommendedProducts);
        } catch (error) {
            // console.error("Error al obtener productos recomendados:", error);
            res.status(500).json({ message: 'Error al obtener productos recomendados' });
            return;
        }
    }


    static async getDestacadosProducts(req: Request, res: Response) {
        try {
            // add pagination
            const { page = '1', limit = '10' } = req.query as {
                page?: string;
                limit?: string;
            };
            const pageNum = parseInt(page, 10);
            const limitNum = parseInt(limit, 10);
            const skip = (pageNum - 1) * limitNum;
            // Obtener productos destacados
            const products = await Product.find({ esDestacado: true })
                .skip(skip)
                .limit(limitNum)
                .sort({ createdAt: -1 })
                .populate('categoria', 'nombre slug');

            // console.log('Products relacionados:', products);

            const totalProducts = await Product.countDocuments({ esDestacado: true });
            if (products.length === 0) {
                res.status(404).json({ message: 'No se encontraron productos destacados' });
                return;
            }
            res.status(200).json({
                products,
                totalPages: Math.ceil(totalProducts / limitNum),
                currentPage: pageNum,
                totalProducts
            });
        } catch (error) {
            res.status(500).json({ message: 'Error fetching featured products' });
            return;
        }
    }
}