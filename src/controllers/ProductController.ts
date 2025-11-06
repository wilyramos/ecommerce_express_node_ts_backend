import { Request, Response } from 'express';
import Category from '../models/Category';
import Product, { type IProduct, type IVariant } from '../models/Product';
import formidable from 'formidable';
// import cloudinary from 'cloudinary';
import { v4 as uuid } from 'uuid';
import cloudinary from '../config/cloudinary';
import { generateUniqueSlug } from '../utils/slug';
import Brand from '../models/Brand';
import type { Types } from 'mongoose';



export class ProductController {

    static async createProduct(req: Request, res: Response) {
        console.log("Creating product with data:", req.body);
        try {
            const {
                nombre,
                descripcion,
                precio,
                precioComparativo,
                costo,
                imagenes,
                categoria,
                stock,
                sku,
                barcode,
                esDestacado,
                esNuevo,
                isActive,
                atributos,
                especificaciones,
                brand,
                diasEnvio,
                variants,
                isFrontPage
            } = req.body;

            // Validar categoría
            const [selectedCategory, hasChildren] = await Promise.all([
                Category.findById(categoria),
                Category.exists({ parent: categoria }),
            ]);

            if (!selectedCategory) {
                res.status(400).json({ message: "La categoría no existe" });
                return;
            }
            if (hasChildren) {
                res.status(400).json({
                    message: "No se puede crear un producto en una categoría que tiene subcategorías",
                });
                return;
            }

            // Validaciones generales
            if (imagenes && imagenes.length > 5) {
                res.status(400).json({ message: "No se pueden subir más de 5 imágenes" });
                return;
            }

            if (atributos && typeof atributos !== "object") {
                res.status(400).json({ message: "Atributos deben ser un objeto" });
                return;
            }

            if (especificaciones && !Array.isArray(especificaciones)) {
                res.status(400).json({ message: "Especificaciones deben ser un array" });
                return;
            }

            if (precioComparativo && Number(precioComparativo) < Number(precio)) {
                res.status(400).json({ message: "El precio comparativo no puede ser menor al precio" });
                return;
            }

            const dias = diasEnvio ? Number(diasEnvio) : 1;
            const slug = await generateUniqueSlug(nombre);

            /**  Procesar variantes */
            /**  Procesar variantes */
            let preparedVariants: IVariant[] = [];

            if (variants && Array.isArray(variants)) {
                preparedVariants = variants.map((v) => {
                    if (!v.atributos || typeof v.atributos !== "object") {
                        throw new Error("Cada variante debe tener atributos válidos");
                    }

                    // Crear nombre automáticamente si no existe
                    const nombreGenerado = v.nombre
                        ? v.nombre
                        : Object.keys(v.atributos)
                            .sort() // ordenar keys para consistencia
                            .map((key) => `${v.atributos[key]}`) // solo valores
                            .join(" / "); // unir con " / " como separación típica

                    return {
                        nombre: nombreGenerado,
                        precio: v.precio ? Number(v.precio) : undefined,
                        precioComparativo: v.precioComparativo ? Number(v.precioComparativo) : undefined,
                        stock: v.stock ? Number(v.stock) : 0,
                        sku: v.sku,
                        barcode: v.barcode,
                        imagenes: v.imagenes ?? [],
                        atributos: v.atributos,
                    };
                });

                // Evitar variantes duplicadas por atributos
                const seen = new Set();
                for (const v of preparedVariants) {
                    const key = JSON.stringify(v.atributos);
                    if (seen.has(key)) {
                        res.status(400).json({ message: "Variantes duplicadas detectadas" });
                        return;
                    }
                    seen.add(key);
                }
            }


            const totalStockFromVariants =
                preparedVariants.length > 0
                    ? preparedVariants.reduce((sum, v) => sum + (v.stock || 0), 0)
                    : Number(stock) || 0;

            const newProduct = {
                nombre,
                slug,
                descripcion,
                precio: Number(precio),
                precioComparativo: precioComparativo ? Number(precioComparativo) : undefined,
                costo,
                imagenes,
                categoria,
                stock: totalStockFromVariants,
                sku,
                barcode,
                esDestacado,
                esNuevo,
                isActive,
                atributos,
                especificaciones,
                brand,
                diasEnvio: dias,
                variants: preparedVariants,
                isFrontPage
            };

            const product = new Product(newProduct);
            await product.save();

            res.status(201).json({ message: "Producto creado correctamente" });

        } catch (error: any) {
            console.error("Error creating product:", error);
            res.status(500).json({ message: error.message || "Error creating product" });
            return;
        }
    }

    static async getProducts(req: Request, res: Response) {
        try {
            const {
                page = "1",
                limit = "10",
                nombre,
                sku,
                precioSort,
                stockSort,
                isActive,
                esNuevo,
                esDestacado,
                query
            } = req.query as Record<string, string>;

            const currentPage = Math.max(parseInt(page) || 1, 1);
            const pageSize = Math.max(parseInt(limit) || 10, 1);
            const skip = (currentPage - 1) * pageSize;

            const filter: Record<string, any> = {};

            // Búsqueda global
            if (query) {
                const searchRegex = new RegExp(query.trim(), "i");
                filter.$or = [
                    { nombre: { $regex: searchRegex } },
                    { descripcion: { $regex: searchRegex } },
                    { sku: { $regex: searchRegex } },
                    { barcode: { $regex: searchRegex } },
                ];
            }

            // Filtros específicos
            if (nombre) filter.nombre = { $regex: new RegExp(nombre, "i") };
            if (sku) filter.sku = { $regex: new RegExp(sku, "i") };

            if (isActive === "true" || isActive === "false") {
                filter.isActive = isActive === "true";
            }

            if (esNuevo === "true" || esNuevo === "false") {
                filter.esNuevo = esNuevo === "true";
            }

            if (esDestacado === "true" || esDestacado === "false") {
                filter.esDestacado = esDestacado === "true";
            }

            // Ordenamiento
            const sort: Record<string, 1 | -1> = {};

            if (precioSort === "asc" || precioSort === "desc") {
                sort.precio = precioSort === "asc" ? 1 : -1;
            }

            if (stockSort === "asc" || stockSort === "desc") {
                sort.stock = stockSort === "asc" ? 1 : -1;
            }

            // Si no hay sort elegido, ordenar por fecha de actualización
            if (Object.keys(sort).length === 0) {
                sort.updatedAt = -1;
            }

            const [products, totalProducts] = await Promise.all([
                Product.find(filter)
                    .skip(skip)
                    .limit(pageSize)
                    .sort(sort)
                    .populate("brand", "nombre slug"),

                Product.countDocuments(filter),
            ]);

            res.status(200).json({
                products,
                totalPages: Math.ceil(totalProducts / pageSize),
                currentPage,
                totalProducts,
            });

        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error fetching products" });
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
                .populate('brand', 'nombre slug')
            // .populate('categoria', 'nombre slug');

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
                    .populate('brand', 'nombre slug'),
                // .populate('categoria', 'nombre slug'),
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

    static async searchProductsIndex(req: Request, res: Response) {
        try {
            const { query } = req.query;
            const searchText = query?.toString().trim() || "";

            const products = await Product.find({ nombre: { $regex: searchText, $options: "i" } })
                .select("nombre precio slug imagenes")
                .limit(10);

            // Responder directamente con el array
            res.status(200).json(products);

        } catch (error) {
            console.error('Error searching products in index:', error);
            res.status(500).json({ message: 'Error al buscar productos en el índice' });
            return;
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
                .populate('categoria', 'nombre slug')
                .populate('brand', 'nombre slug');

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
                .populate('categoria', 'nombre slug')
                .populate('brand', 'nombre slug');

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
            const product = await Product.findOne({ slug })
                .populate('categoria', 'nombre slug')
                .populate('brand', 'nombre slug');


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
                precioComparativo,
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
                especificaciones,
                brand,
                diasEnvio,
                variants,
                isFrontPage
            } = req.body;

            const productId = req.params.id;
            const existingProduct = await Product.findById(productId);
            if (!existingProduct) {
                res.status(404).json({ message: 'Producto no encontrado' });
                return;
            }

            // Validar y actualizar categoría
            let categoriaCambio = false;
            if (categoria && categoria !== existingProduct.categoria.toString()) {
                const selectedCategory = await Category.findById(categoria);
                if (!selectedCategory) {
                    res.status(400).json({ message: 'La categoría no existe' });
                    return;
                }

                const hasChildren = await Category.exists({ parent: categoria });
                if (hasChildren) {
                    res.status(400).json({ message: 'No se puede cambiar a una categoría que tiene subcategorías' });
                    return;
                }

                categoriaCambio = true;
                existingProduct.categoria = categoria;
            }

            if (atributos && typeof atributos !== 'object') {
                res.status(400).json({ message: 'Los atributos deben ser un objeto' });
                return;
            }

            if (categoriaCambio) {
                existingProduct.atributos = atributos || {};
            } else if (atributos) {
                existingProduct.atributos = atributos;
            }

            if (imagenes && imagenes.length > 5) {
                res.status(400).json({ message: 'No se pueden subir más de 5 imágenes' });
                return;
            }

            if (especificaciones && !Array.isArray(especificaciones)) {
                res.status(400).json({ message: 'Especificaciones deben ser un array' });
                return;
            }

            if (precioComparativo && Number(precioComparativo) < Number(precio)) {
                res.status(400).json({ message: 'El precio comparativo no puede ser menor que el precio' });
                return;
            }

            if (diasEnvio && Number(diasEnvio) <= 0) {
                res.status(400).json({ message: 'Los días de envío deben ser un número positivo' });
                return;
            }

            if (variants && !Array.isArray(variants)) {
                res.status(400).json({ message: 'Variants debe ser un array' });
                return;
            }

            const dias = diasEnvio ? Number(diasEnvio) : existingProduct.diasEnvio;

            // Actualizar slug si cambió el nombre
            if (nombre && nombre !== existingProduct.nombre) {
                const newSlug = await generateUniqueSlug(nombre);
                existingProduct.slug = newSlug;
            }

            // Procesar variantes: generar nombre automático y validar
            let preparedVariants: IVariant[] | undefined;
            if (variants && Array.isArray(variants)) {
                preparedVariants = variants.map((v) => {
                    if (!v.atributos || typeof v.atributos !== "object") {
                        throw new Error("Cada variante debe tener atributos válidos");
                    }

                    const nombreGenerado = v.nombre
                        ? v.nombre
                        : Object.keys(v.atributos)
                            .sort()
                            .map((key) => `${v.atributos[key]}`)
                            .join(" / ");

                    return {
                        nombre: nombreGenerado,
                        precio: v.precio != null ? Number(v.precio) : undefined,
                        precioComparativo: v.precioComparativo != null ? Number(v.precioComparativo) : undefined,
                        stock: v.stock != null ? Number(v.stock) : 0,
                        sku: v.sku,
                        barcode: v.barcode,
                        imagenes: v.imagenes ?? [],
                        atributos: v.atributos,
                    };
                });

                // Evitar duplicados
                const seen = new Set();
                for (const v of preparedVariants) {
                    const key = JSON.stringify(v.atributos);
                    if (seen.has(key)) {
                        res.status(400).json({ message: "Variantes duplicadas detectadas" });
                        return;
                    }
                    seen.add(key);
                }

                existingProduct.variants = preparedVariants;

                // Actualizar stock total desde variantes si existen
                existingProduct.stock = preparedVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
            } else if (!variants) {
                // Si no se envían variantes, mantener stock manual si existe
                if (stock != null) existingProduct.stock = stock;
            }

            // Actualizar otros campos
            existingProduct.nombre = nombre || existingProduct.nombre;
            existingProduct.descripcion = descripcion || existingProduct.descripcion;
            if (precio != null) existingProduct.precio = Number(precio);
            if (precioComparativo === undefined) existingProduct.precioComparativo = undefined;
            else if (precioComparativo != null) existingProduct.precioComparativo = Number(precioComparativo);
            if (costo != null) existingProduct.costo = Number(costo);
            if (imagenes) existingProduct.imagenes = imagenes;
            existingProduct.sku = sku || existingProduct.sku;
            existingProduct.barcode = barcode || existingProduct.barcode;
            existingProduct.esDestacado = esDestacado !== undefined ? esDestacado : existingProduct.esDestacado;
            existingProduct.esNuevo = esNuevo !== undefined ? esNuevo : existingProduct.esNuevo;
            existingProduct.isActive = isActive !== undefined ? isActive : existingProduct.isActive;
            existingProduct.especificaciones = especificaciones || existingProduct.especificaciones;
            existingProduct.brand = brand || existingProduct.brand;
            existingProduct.diasEnvio = dias;
            existingProduct.isFrontPage = isFrontPage !== undefined ? isFrontPage : existingProduct.isFrontPage;

            await existingProduct.save();
            res.status(200).json({ message: 'Producto actualizado correctamente' });
        } catch (error: any) {
            console.error("Error updating product:", error);
            res.status(500).json({ message: 'Error updating product', error: error.message || error });
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
                .populate('brand', 'nombre slug')
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


    static async getProductsRelated(req: Request, res: Response) {
        const { slug } = req.params;
        const LIMIT_TOTAL = 4; // Límite total de productos a mostrar

        try {
            // 1. Encontrar el producto base
            const product = await Product.findOne({ slug })
                .populate('categoria', 'nombre slug')
                .populate('brand', 'nombre slug');

            if (!product) {
                res.status(404).json({ message: 'Producto no encontrado' });
                return;
            }

            // Aseguramos el tipo para el ID actual y de las categorías/marcas
            const currentProductId: Types.ObjectId = product._id as Types.ObjectId;
            // Usamos el ID de la categoría para las búsquedas
            const categoryId: Types.ObjectId = (product.categoria as any)._id as Types.ObjectId;
            const brandId: Types.ObjectId | null = product.brand ? (product.brand as any)._id as Types.ObjectId : null;

            const selectedIds = new Set<Types.ObjectId>([currentProductId]);
            let recommendedProducts: IProduct[] = [];

            // --- ESTRATEGIA 1: Productos de la misma categoría, aleatorios (Pool más grande) ---

            const categoryMatch = {
                categoria: categoryId,
                _id: { $ne: currentProductId },
                isActive: true
            };

            const randomCategoryProducts = await Product.aggregate([
                { $match: categoryMatch },
                { $sample: { size: LIMIT_TOTAL * 2 } },
                {
                    $lookup: {
                        from: 'brands',
                        localField: 'brand',
                        foreignField: '_id',
                        as: 'brand'
                    }
                },
                { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
                { $project: { __v: 0 } } // 💡 Cambio: Eliminamos 'categoria: 0' para que se envíe el ID como string
            ]) as (IProduct & { _id: Types.ObjectId })[];

            randomCategoryProducts.forEach(p => {
                const pId = p._id as Types.ObjectId;
                if (!selectedIds.has(pId)) {
                    selectedIds.add(pId);
                    recommendedProducts.push(p);
                }
            });

            if (recommendedProducts.length >= LIMIT_TOTAL) {
                recommendedProducts = recommendedProducts.slice(0, LIMIT_TOTAL);
                res.status(200).json(recommendedProducts);
                return;
            }

            // --- ESTRATEGIA 2: Productos de la misma marca (Relleno de prioridad) ---

            if (brandId) {
                const excludedIdsArray = Array.from(selectedIds);

                const brandMatch = {
                    brand: brandId,
                    _id: { $nin: excludedIdsArray },
                    isActive: true
                };

                const brandProducts = await Product.find(brandMatch)
                    .limit(LIMIT_TOTAL - recommendedProducts.length)
                    .sort({ 'esDestacado': -1, createdAt: -1 })
                    .populate('brand', 'nombre slug')
                // 💡 Cambio: No usamos .select('-categoria') para que la categoría se envíe como ID (string)
                // Si se popula la marca, la categoría por defecto se envía como ObjectId string
                // a menos que se use .select() para excluirla explícitamente.

                brandProducts.forEach(p => {
                    const pId = p._id as Types.ObjectId;
                    if (!selectedIds.has(pId)) {
                        selectedIds.add(pId);
                        recommendedProducts.push(p);
                    }
                });
            }

            if (recommendedProducts.length >= LIMIT_TOTAL) {
                recommendedProducts = recommendedProducts.slice(0, LIMIT_TOTAL);
                res.status(200).json(recommendedProducts);
                return;
            }

            // --- ESTRATEGIA 3: Productos de Relleno Aleatorio/Popular (Último recurso) ---

            const excludedIdsFinalArray = Array.from(selectedIds);

            const fillProducts = await Product.aggregate([
                { $match: { _id: { $nin: excludedIdsFinalArray }, isActive: true } },
                { $sample: { size: LIMIT_TOTAL - recommendedProducts.length } },
                {
                    $lookup: { from: 'brands', localField: 'brand', foreignField: '_id', as: 'brand' }
                },
                { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
                { $project: { __v: 0 } } // 💡 Cambio: Eliminamos 'categoria: 0' para que se envíe el ID como string
            ]) as (IProduct & { _id: Types.ObjectId })[];

            fillProducts.forEach(p => {
                recommendedProducts.push(p);
            });


            // 4. Devolver los resultados finales, limitados si se sobrepasan
            res.status(200).json(recommendedProducts.slice(0, LIMIT_TOTAL));

        } catch (error) {
            console.error("Error al obtener productos recomendados:", error);
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
                .populate('brand', 'nombre slug')
            // .populate('categoria', 'nombre slug');

            console.log("Destacados products:", products);

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

    static async getFrontPageProducts(req: Request, res: Response) {
        try {
             const { page = '1', limit = '10' } = req.query as {
                page?: string;
                limit?: string;
            };
            const pageNum = parseInt(page, 10);
            const limitNum = parseInt(limit, 10);
            const skip = (pageNum - 1) * limitNum;

            const products = await Product.find({ isFrontPage: true })
                .skip(skip)
                .limit(limitNum)
                .sort({ createdAt: -1 })
                .populate('brand', 'nombre slug')
            // .populate('categoria', 'nombre slug');

            const totalProducts = await Product.countDocuments({ isFrontPage: true });

            if (products.length === 0) {
                res.status(404).json({ message: 'No se encontraron productos para la página principal' });
                return;
            }

            res.status(200).json({
                products,
                totalPages: Math.ceil(totalProducts / limitNum),
                currentPage: pageNum,
                totalProducts
            });
        } catch (error) {
            res.status(500).json({ message: 'Error fetching front page products' });
            return;
        }

    }

    static async getAllProductsSlug(req: Request, res: Response) {
        try {
            const products = await Product.find().select('slug updatedAt')
            res.status(200).json(products);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching all products slug' });
            return;
        }
    }

    static async getProductsByBrandSlug(req: Request, res: Response) {
        try {
            const { brandSlug } = req.params;
            const { page = '1', limit = '10' } = req.query as {
                page?: string;
                limit?: string;
            };

            const pageNum = parseInt(page, 10);
            const limitNum = parseInt(limit, 10);
            const skip = (pageNum - 1) * limitNum;

            console.log('brandSlug:', brandSlug);
            const brand = await Brand.findOne({ slug: brandSlug });
            console.log('brand:', brand);
            if (!brand) {
                res.status(404).json({ message: 'Marca no encontrada' });
                return;
            }
            const products = await Product.find({ brand: brand._id })
                .skip(skip)
                .limit(limitNum)
                .sort({ createdAt: -1 })
                .populate('brand', 'nombre slug')
            // .populate('categoria', 'nombre slug');

            const totalProducts = await Product.countDocuments({ brand: brand._id });

            if (products.length === 0) {
                res.status(404).json({ message: 'No se encontraron productos para esta marca' });
                return;
            }
            res.status(200).json({
                products,
                totalPages: Math.ceil(totalProducts / limitNum),
                currentPage: pageNum,
                totalProducts
            });
        } catch (error) {
            res.status(500).json({ message: 'Error al obtener productos por marca' });
            return;
        }
    }

    static async getProductsMainPage(req: Request, res: Response) {
        try {
            const { query, page, limit, category, priceRange, sort, ...rest } = req.query as {
                query?: string;
                page?: string;
                limit?: string;
                category?: string;
                priceRange?: string;
                sort?: string;
                [key: string]: any;
            };

            const pageNum = parseInt(page || "1", 10);
            const limitNum = parseInt(limit || "10", 10);
            const skip = (pageNum - 1) * limitNum;

            // Query base
            const searchQuery: any = { isActive: true };

            // 🔎 Búsqueda por texto
            if (query && query.trim() !== "") {
                const regex = new RegExp(query.trim(), "i");
                searchQuery.$or = [{ nombre: regex }, { descripcion: regex }];
            }

            // 📂 Filtro por categoría
            if (category) {
                searchQuery.categoria = category;
            }

            // Buscar el brand por su slug
            if (rest.brand) {
                const brandDoc = await Brand.findOne({ slug: rest.brand });
                if (brandDoc) {
                    searchQuery.brand = brandDoc._id;
                }
            }

            // 💲 Filtro por rango de precios "min-max"
            if (priceRange) {
                const [minStr, maxStr] = priceRange.split("-");
                const min = Number(minStr);
                const max = Number(maxStr);
                if (!isNaN(min) && !isNaN(max) && min >= 0 && max >= 0 && min <= max) {
                    searchQuery.precio = { $gte: min, $lte: max };
                }
            }

            // Ej: ?Color=Rojo&Color=Verde&Talla=M
            Object.keys(rest).forEach((key) => {

                if (["brand", "category", "priceRange", "sort", "page", "limit", "query"].includes(key)) {
                    return;
                }

                const values = Array.isArray(rest[key]) ? rest[key] : [rest[key]];
                if (values.length > 0) {
                    searchQuery[`atributos.${key}`] = { $in: values };
                }
            });

            // 📑 Orde
            let sortQuery: Record<string, 1 | -1> = { createdAt: -1 };
            if (sort) {
                switch (sort) {
                    case "price-asc":
                        sortQuery = { precio: 1 };
                        break;
                    case "price-desc":
                        sortQuery = { precio: -1 };
                        break;
                    case "name-asc":
                        sortQuery = { nombre: 1 };
                        break;
                    case "name-desc":
                        sortQuery = { nombre: -1 };
                        break;
                    case "recientes":
                        sortQuery = { createdAt: -1 };
                        break;
                }
            }

            // 📦 Promesas en paralelo
            const productsPromise = Product.find(searchQuery)
                .skip(skip)
                .limit(limitNum)
                .sort(sortQuery)
                .populate('brand', 'nombre slug');

            const totalPromise = Product.countDocuments(searchQuery);

            const filtersPromise = Product.aggregate([
                { $match: searchQuery },
                {
                    $facet: {
                        brands: [
                            { $group: { _id: "$brand" } },
                            {
                                $lookup: {
                                    from: "brands",
                                    localField: "_id",
                                    foreignField: "_id",
                                    as: "brand",
                                },
                            },
                            { $unwind: "$brand" },
                            { $project: { id: "$brand._id", nombre: "$brand.nombre", slug: "$brand.slug" } },
                        ],
                        atributos: [
                            { $project: { atributos: { $objectToArray: "$atributos" } } },
                            { $unwind: "$atributos" },
                            {
                                $group: {
                                    _id: "$atributos.k",
                                    values: { $addToSet: "$atributos.v" },
                                },
                            },
                            { $project: { name: "$_id", values: 1, _id: 0 } },
                        ],
                        price: [
                            {
                                $group: {
                                    _id: null,
                                    min: { $min: "$precio" },
                                    max: { $max: "$precio" },
                                },
                            },
                        ],
                    },
                },
            ]);

            const [filters, products, totalProducts] = await Promise.all([
                filtersPromise,
                productsPromise,
                totalPromise,
            ]);

            res.status(200).json({
                products,
                totalPages: Math.ceil(totalProducts / limitNum),
                currentPage: pageNum,
                totalProducts,
                filters,
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error fetching main page products" });
            return;
        }
    }
}