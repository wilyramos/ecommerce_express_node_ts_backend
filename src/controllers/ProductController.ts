import { Request, Response } from 'express';
import Category from '../models/Category';
import Product, { type IProduct, type IVariant } from '../models/Product';
import formidable from 'formidable';
// import cloudinary from 'cloudinary';
import { v4 as uuid } from 'uuid';
import cloudinary from '../config/cloudinary';
import { generateUniqueSlug } from '../utils/slug';
import Brand from '../models/Brand';
import type { PipelineStage, Types } from 'mongoose';
import mongoose from 'mongoose';
import sharp from 'sharp';
import { ca } from 'date-fns/locale';


export class ProductController {
    static async createProduct(req: Request, res: Response) {
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

            const [selectedCategory, hasChildren] = await Promise.all([
                Category.findById(categoria),
                Category.exists({ parent: categoria })
            ]);

            if (!selectedCategory) {
                res.status(400).json({ message: 'La categoría no existe' });
                return;
            }

            if (hasChildren) {
                res.status(400).json({
                    message: 'No se puede crear un producto en una categoría que tiene subcategorías'
                });
                return;
            }

            if (imagenes && imagenes.length > 5) {
                res.status(400).json({ message: 'No se pueden subir más de 5 imágenes' });
                return;
            }

            if (atributos && typeof atributos !== 'object') {
                res.status(400).json({ message: 'Atributos deben ser un objeto' });
                return;
            }

            if (especificaciones && !Array.isArray(especificaciones)) {
                res.status(400).json({ message: 'Especificaciones deben ser un array' });
                return;
            }

            if (precioComparativo && Number(precioComparativo) < Number(precio)) {
                res.status(400).json({ message: 'El precio comparativo no puede ser menor al precio' });
                return;
            }

            const dias = diasEnvio ? Number(diasEnvio) : 1;
            const slug = await generateUniqueSlug(nombre);

            let preparedVariants: IVariant[] = [];

            if (variants && Array.isArray(variants)) {
                preparedVariants = variants.map(v => {
                    if (!v.atributos || typeof v.atributos !== 'object') {
                        throw new Error('Cada variante debe tener atributos válidos');
                    }

                    const nombreGenerado = v.nombre
                        ? v.nombre
                        : Object.keys(v.atributos)
                            .sort()
                            .map(key => `${v.atributos[key]}`)
                            .join(' / ');

                    return {
                        nombre: nombreGenerado,
                        precio: v.precio ? Number(v.precio) : undefined,
                        precioComparativo: v.precioComparativo ? Number(v.precioComparativo) : undefined,
                        stock: v.stock ? Number(v.stock) : 0,
                        sku: v.sku,
                        barcode: v.barcode,
                        imagenes: v.imagenes ?? [],
                        atributos: v.atributos
                    };
                });

                const seen = new Set();
                for (const v of preparedVariants) {
                    const key = JSON.stringify(v.atributos);
                    if (seen.has(key)) {
                        res.status(400).json({ message: 'Variantes duplicadas detectadas' });
                        return;
                    }
                    seen.add(key);
                }
            }

            const totalStockFromVariants =
                preparedVariants.length > 0
                    ? preparedVariants.reduce((sum, v) => sum + (v.stock || 0), 0)
                    : stock;

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

            res.status(201).json({ message: 'Producto creado correctamente' });
        } catch (error: any) {
            console.error('Error creating product:', error);
            res.status(500).json({ message: error.message || 'Error creating product' });
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
                query,
                brand,
                category,
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
            if (brand) {
                filter.brand = brand;
            }

            console.log('Category filter value:', category);
            if (category) filter.categoria = new mongoose.Types.ObjectId(category);

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
                // Eliminamos 'query' de la desestructuración principal para no considerarlo,
                // pero mantenemos los demás parámetros dinámicos en 'req.query'
            } = req.query as {
                page?: string;
                limit?: string;
                category?: string;
                priceRange?: string;
                sort?: string;
                query?: string; // Lo mantenemos opcional en el tipo pero no lo usamos
                [key: string]: string | string[] | undefined;
            };

            const pageNum = parseInt(page, 10);
            const limitNum = parseInt(limit, 10);
            const skip = (pageNum - 1) * limitNum;

            // Base de filtros. Usaremos 'filter' como 'searchQuery'
            const filter: Record<string, any> = { isActive: true };

            // --- Categoría (por slug)
            if (category) {
                const categoryDoc = await Category.findOne({ slug: category });
                if (categoryDoc) {
                    filter.categoria = categoryDoc._id;
                } else {
                    // Si no existe la categoría, forzamos a que no devuelva nada
                    filter.categoria = null;
                }
            }

            // --- Marca (similar a getProductsMainPage, aunque no estaba en la versión anterior de ByFilter)
            const brandSlug = req.query.brand as string;
            if (brandSlug) {
                const brandDoc = await Brand.findOne({ slug: brandSlug });
                if (brandDoc) {
                    filter.brand = brandDoc._id;
                }
            }

            // --- Rango de precios: Considerar precio base O precio de variante
            const priceStr = priceRange;
            if (priceStr) {
                const [minStr, maxStr] = priceStr.split('-');
                const min = Number(minStr);
                const max = Number(maxStr);
                if (!isNaN(min) && !isNaN(max) && min >= 0 && max >= 0 && min <= max) {
                    // Aplicar $or para precio del producto base O precio de la variante
                    filter.$or = [
                        { precio: { $gte: min, $lte: max } },
                        { "variants.precio": { $gte: min, $lte: max } },
                    ];
                } else {
                    res.status(400).json({ message: 'Invalid price range' });
                    return;
                }
            }

            // --- Atributos dinámicos: atributos[Tamaño]=250ml, atributos[Material]=Aluminio, etc.
            // Los filtros de atributos dinámicos deben combinarse con $and para que se apliquen simultáneamente.
            const dynamicAttributeFilters: any[] = [];

            for (const key in req.query) {
                // Aseguramos que solo procesamos los parámetros que comienzan con "atributos[" y terminan con "]"
                if (key.startsWith("atributos[") && key.endsWith("]")) {
                    const attrKey = key.slice(10, -1);
                    const value = req.query[key];

                    if (attrKey.length > 0) {
                        let valuesArray: any[] = [];

                        if (typeof value === "string") {
                            valuesArray = value.split(",").map(v => v.trim()).filter(Boolean);
                        } else if (Array.isArray(value)) {
                            valuesArray = value.map(v => String(v).trim()).filter(Boolean);
                        }

                        if (valuesArray.length > 0) {
                            // Creamos una condición $or para este atributo: (producto padre) OR (alguna variante)
                            dynamicAttributeFilters.push({
                                $or: [
                                    { [`atributos.${attrKey}`]: { $in: valuesArray } },
                                    { variants: { $elemMatch: { [`atributos.${attrKey}`]: { $in: valuesArray } } } }
                                ]
                            });
                        }
                    }
                }
            }

            // Aplicamos todos los filtros de atributos dinámicos juntos con un $and
            if (dynamicAttributeFilters.length > 0) {
                if (!filter.$and) filter.$and = [];
                filter.$and.push(...dynamicAttributeFilters);
            }

            // NOTA: Se elimina la sección de 'orConditions' y 'Texto de búsqueda general' (query)
            // ya que el requisito es ya no buscar productos por query.

            // --- Ordenamiento
            let sortOptions: Record<string, 1 | -1> = { stock: -1, createdAt: -1 };
            if (sort) {
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
                    case 'recientes':
                        sortOptions = { createdAt: -1 };
                        break;
                }
            }

            // --- Consulta a la base de datos
            const [products, totalProducts] = await Promise.all([
                Product.find(filter)
                    .skip(skip)
                    .limit(limitNum)
                    .sort(sortOptions)
                    .populate('brand', 'nombre slug'),
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
            console.error('Error fetching products by filter:', error);
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
                .populate('brand', 'nombre slug')
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

            // Si no hay texto de búsqueda, devolver lista vacía
            if (!searchText) {
                res.status(200).json([]);
                return;
            }

            const pipeline: any[] = [
                // 1. Etapa de Búsqueda (Atlas Search)
                // Usamos el mismo índice 'ecommerce_search_products' que creamos para la página principal
                {
                    $search: {
                        index: "ecommerce_search_products",
                        compound: {
                            should: [
                                {
                                    text: {
                                        query: searchText,
                                        path: "nombre",
                                        score: { boost: { value: 3 } }, // Prioridad 1: Coincidencia en Nombre
                                        fuzzy: { maxEdits: 1 } // Permite pequeños errores (ej: "ipone" -> "iphone")
                                    }
                                },
                                {
                                    text: {
                                        query: searchText,
                                        path: "variants.nombre",
                                        score: { boost: { value: 2 } }, // Prioridad 2: Coincidencia en Variante
                                        fuzzy: { maxEdits: 1 }
                                    }
                                },
                                {
                                    text: {
                                        query: searchText,
                                        path: "descripcion",
                                        score: { boost: { value: 1 } }, // Prioridad 3: Descripción
                                        fuzzy: { maxEdits: 1 }
                                    }
                                }
                            ],
                            minimumShouldMatch: 1 // Al menos una coincidencia es necesaria
                        }
                    }
                },
                // 2. Match (Filtros duros)
                // Filtramos por activos. Nota: Es más eficiente hacer esto después del search
                // a menos que isActive esté indexado como "token" en Atlas Search.
                {
                    $match: {
                        isActive: true
                    }
                },
                // 3. Limit (Solo necesitamos 5 para el dropdown)
                {
                    $limit: 5
                },
                // 4. Project (Equivalente a .select() y .slice())
                {
                    $project: {
                        _id: 1,
                        nombre: 1,
                        precio: 1,
                        precioComparativo: 1,
                        breand: 1,
                        slug: 1,
                        esDestacado: 1,
                        esNuevo: 1,
                        // MongoDB Aggregation usa $slice para recortar arrays
                        imagenes: { $slice: ["$imagenes", 1] }
                    }
                }
            ];

            const products = await Product.aggregate(pipeline);

            res.status(200).json(products);
            return;

        } catch (error) {
            console.error("Error searching products in index:", error);
            res.status(500).json({ message: "Error al buscar productos" });
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

            const productId = req.params.id;
            const existingProduct = await Product.findById(productId);

            if (!existingProduct) {
                res.status(404).json({ message: 'Producto no encontrado' });
                return;
            }

            if (imagenes && imagenes.length > 5) {
                res.status(400).json({ message: 'No se pueden subir más de 5 imágenes' });
                return;
            }

            if (atributos && typeof atributos !== 'object') {
                res.status(400).json({ message: 'Los atributos deben ser un objeto' });
                return;
            }

            if (especificaciones && !Array.isArray(especificaciones)) {
                res.status(400).json({ message: 'Las especificaciones deben ser un array' });
                return;
            }

            if (categoria) {
                const categoryExists = await Category.findById(categoria);
                if (!categoryExists) {
                    res.status(400).json({ message: 'La categoría especificada no existe' });
                    return;
                }
                existingProduct.categoria = categoria;
            }

            const dias = diasEnvio ? Number(diasEnvio) : existingProduct.diasEnvio;

            if (Array.isArray(variants) && variants.length > 0) {
                const preparedVariants = variants.map(v => {
                    if (!v.atributos || typeof v.atributos !== 'object')
                        throw new Error('Cada variante debe tener atributos válidos');

                    const nombreGenerado =
                        v.nombre ||
                        Object.keys(v.atributos)
                            .sort()
                            .map(key => `${v.atributos[key]}`)
                            .join(' / ');

                    let precioComparativoFinal =
                        v.precioComparativo != null ? Number(v.precioComparativo) : undefined;

                    if (
                        precioComparativoFinal !== undefined &&
                        (precioComparativoFinal <= 0 ||
                            (v.precio != null &&
                                precioComparativoFinal < Number(v.precio)))
                    ) {
                        precioComparativoFinal = undefined;
                    }

                    return {
                        nombre: nombreGenerado,
                        precio: v.precio != null ? Number(v.precio) : undefined,
                        precioComparativo: precioComparativoFinal,
                        stock: v.stock != null ? Number(v.stock) : 0,
                        sku: v.sku,
                        barcode: v.barcode,
                        imagenes: v.imagenes ?? [],
                        atributos: v.atributos
                    };
                });

                const seen = new Set();
                for (const v of preparedVariants) {
                    const key = JSON.stringify(v.atributos);
                    if (seen.has(key)) {
                        res.status(400).json({ message: 'Variantes duplicadas detectadas' });
                        return;
                    }
                    seen.add(key);
                }

                existingProduct.variants = preparedVariants;
                existingProduct.stock = preparedVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
            } else {
                existingProduct.variants = [];
                if (stock != null) existingProduct.stock = Number(stock);
            }

            if (nombre && nombre !== existingProduct.nombre) {
                existingProduct.slug = await generateUniqueSlug(nombre);
                existingProduct.nombre = nombre;
            }

            if (descripcion) existingProduct.descripcion = descripcion;
            if (precio != null) existingProduct.precio = Number(precio);

            if (
                precioComparativo !== undefined &&
                precioComparativo !== null &&
                Number(precioComparativo) > 0 &&
                (precio == null || Number(precioComparativo) >= Number(precio))
            ) {
                existingProduct.precioComparativo = Number(precioComparativo);
            } else {
                existingProduct.precioComparativo = undefined;
            }

            if (costo != null) existingProduct.costo = Number(costo);
            if (imagenes) existingProduct.imagenes = imagenes;
            if (sku) existingProduct.sku = sku;
            if (barcode) existingProduct.barcode = barcode;
            if (brand) existingProduct.brand = brand;
            if (atributos) existingProduct.atributos = atributos;
            if (especificaciones) existingProduct.especificaciones = especificaciones;

            existingProduct.diasEnvio = dias;
            existingProduct.esDestacado = esDestacado ?? existingProduct.esDestacado;
            existingProduct.esNuevo = esNuevo ?? existingProduct.esNuevo;
            existingProduct.isActive = isActive ?? existingProduct.isActive;
            existingProduct.isFrontPage = isFrontPage ?? existingProduct.isFrontPage;

            await existingProduct.save();

            res.status(200).json({ message: 'Producto actualizado correctamente' });
        } catch (error: any) {
            console.error('Error updating product:', error);
            res.status(500).json({ message: 'Error actualizando producto', error: error.message });
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

        const form = formidable({ multiples: true });

        form.parse(req, async (error, fields, files) => {
            if (error) {
                console.error("Error al procesar los archivos:", error);
                res.status(400).json({ message: "Error al procesar los archivos" });
                return;
            }

            if (!files.images) {
                res.status(400).json({ message: "No se han recibido imágenes" });
                return;
            }

            const images = Array.isArray(files.images) ? files.images : [files.images];

            if (images.length > 6) {
                res.status(400).json({ message: "No se pueden subir más de 6 imágenes" });
                return;
            }

            try {
                const imageUrls = [];

                const uploadPromises = images.map(async (image) => {

                    // Convertir a WEBP usando SHARP
                    const webpBuffer = await sharp(image.filepath)
                        .webp({ quality: 85 }) //
                        .toBuffer();

                    // Subir buffer WebP a Cloudinary
                    return new Promise((resolve, reject) => {
                        const stream = cloudinary.uploader.upload_stream(
                            {
                                public_id: uuid(),
                                folder: "products",
                                format: "webp"
                            },
                            (err, result) => {
                                if (err) reject(err);
                                else resolve(result);
                            }
                        );

                        stream.end(webpBuffer); // Enviar buffer convertido
                    });
                });

                const results: any = await Promise.all(uploadPromises);

                results.forEach(result => {
                    imageUrls.push(result.secure_url);
                });

                res.status(200).json({ images: imageUrls });
                return;

            } catch (error) {
                console.error("Error al subir las imágenes:", error);

                res.status(500).json({ message: "Error al subir las imágenes" });
                return;
            }
        });
    }


    static async getAllImagesFromCloudinary(req: Request, res: Response) {
        try {
            const resources = await cloudinary.api.resources({
                type: 'upload',
                prefix: 'products/',
                max_results: 100
            });
            const imageUrls = resources.resources.map((resource: any) => resource.secure_url);
            res.status(200).json({ images: imageUrls });
        } catch (error) {
            console.error("Error al obtener las imágenes:", error);
            res.status(500).json({ message: 'Error al obtener las imágenes' });
        }
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
        const LIMIT_TOTAL = 6; // Límite total de productos a mostrar

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

            // 1. Construir el Pipeline Base (Search + Match)
            const basePipeline: any[] = [];

            // A) ETAPA $SEARCH (Solo si hay query de texto)
            if (query && query.trim() !== "") {
                basePipeline.push({
                    $search: {
                        index: "ecommerce_search_products",
                        compound: {
                            should: [
                                { text: { query: query, path: "nombre", score: { boost: { value: 3 } }, fuzzy: { maxEdits: 1 } } },
                                { text: { query: query, path: "variants.nombre", score: { boost: { value: 2 } }, fuzzy: { maxEdits: 1 } } },
                                { text: { query: query, path: "descripcion", fuzzy: { maxEdits: 1 } } }
                            ],
                            minimumShouldMatch: 1
                        }
                    }
                });
            }

            // B) ETAPA $MATCH (Filtros duros)
            const matchStage: any = { isActive: true };

            if (category) {
                const categoryDoc = await Category.findOne({ slug: category });
                matchStage.categoria = categoryDoc ? categoryDoc._id : null;
            }

            if (rest.brand) {
                const brandDoc = await Brand.findOne({ slug: rest.brand });
                if (brandDoc) matchStage.brand = brandDoc._id;
            }

            if (priceRange) {
                const [minStr, maxStr] = priceRange.split("-");
                const min = Number(minStr);
                const max = Number(maxStr);
                if (!isNaN(min) && !isNaN(max)) {
                    matchStage.$or = [
                        { precio: { $gte: min, $lte: max } },
                        { "variants.precio": { $gte: min, $lte: max } }
                    ];
                }
            }

            // Filtros Dinámicos (Atributos)
            const activeFilters: Record<string, string[]> = {};
            const attributeFilters: any[] = [];

            Object.keys(rest).forEach((key) => {
                if (["brand", "category", "priceRange", "sort", "page", "limit", "query"].includes(key)) return;

                const values = Array.isArray(rest[key]) ? rest[key] : [rest[key]];
                if (values.length > 0) {
                    activeFilters[key] = values;
                    attributeFilters.push({
                        $or: [
                            { [`atributos.${key}`]: { $in: values } },
                            { variants: { $elemMatch: { [`atributos.${key}`]: { $in: values } } } }
                        ]
                    });
                }
            });

            if (attributeFilters.length > 0) {
                matchStage.$and = attributeFilters;
            }

            basePipeline.push({ $match: matchStage });

            // 2. Definir Ordenamiento (Sort)
            let sortStage: any = {};

            if (sort) {
                switch (sort) {
                    case "price-asc": sortStage = { precio: 1 }; break;
                    case "price-desc": sortStage = { precio: -1 }; break;
                    case "recientes": sortStage = { createdAt: -1 }; break;
                    case "name-asc": sortStage = { nombre: 1 }; break;
                    case "name-desc": sortStage = { nombre: -1 }; break;
                    default: sortStage = { stock: -1, createdAt: -1 };
                }
            } else if (query && query.trim() !== "") {
                sortStage = { unused: { $meta: "searchScore" } };
            } else {
                sortStage = { stock: -1, createdAt: -1 };
            }

            // 3. Ejecutar Aggregations en Paralelo

            // A. Obtener Productos
            const productsPipeline = [
                ...basePipeline,
                ...(Object.keys(sortStage).length > 0 && !sortStage.unused ? [{ $sort: sortStage }] : []),
                { $skip: skip },
                { $limit: limitNum },
                {
                    $lookup: {
                        from: "brands",
                        localField: "brand",
                        foreignField: "_id",
                        as: "brand"
                    }
                },
                { $unwind: { path: "$brand", preserveNullAndEmptyArrays: true } },
                {
                    $project: {
                        nombre: 1, slug: 1, descripcion: 1, precio: 1, precioComparativo: 1, costo: 1,
                        imagenes: 1, categoria: 1, brand: { _id: 1, nombre: 1, slug: 1 },
                        stock: 1, sku: 1, barcode: 1, isActive: 1, esDestacado: 1, esNuevo: 1,
                        atributos: 1, especificaciones: 1, diasEnvio: 1, fechaDisponibilidad: 1, variants: 1,
                        createdAt: 1, updatedAt: 1
                    }
                }
            ];

            // B. Obtener Conteo Total
            const countPipeline = [
                ...basePipeline,
                { $count: "total" }
            ];

            // C. Obtener Filtros (Facets)
            const filtersPipeline = [
                ...basePipeline,
                {
                    $facet: {
                        brands: [
                            { $group: { _id: "$brand" } },
                            { $lookup: { from: "brands", localField: "_id", foreignField: "_id", as: "brand" } },
                            { $unwind: "$brand" },
                            { $project: { id: "$brand._id", nombre: "$brand.nombre", slug: "$brand.slug" } },
                        ],
                        categories: [
                            { $group: { _id: "$categoria" } },
                            { $lookup: { from: "categories", localField: "_id", foreignField: "_id", as: "category" } },
                            { $unwind: "$category" },
                            { $project: { id: "$category._id", nombre: "$category.nombre", slug: "$category.slug" } },
                        ],
                        atributos: [
                            {
                                $project: {
                                    combinedAtributos: {
                                        $concatArrays: [
                                            { $objectToArray: "$atributos" },
                                            {
                                                $reduce: {
                                                    input: "$variants",
                                                    initialValue: [],
                                                    in: { $concatArrays: ["$$value", { $objectToArray: "$$this.atributos" }] }
                                                }
                                            }
                                        ]
                                    }
                                }
                            },
                            { $unwind: { path: "$combinedAtributos", preserveNullAndEmptyArrays: true } },
                            {
                                $project: {
                                    key: "$combinedAtributos.k",
                                    value: "$combinedAtributos.v"
                                }
                            },
                            { $match: { key: { $exists: true, $ne: "" } } },
                            {
                                $group: {
                                    _id: "$key",
                                    values: { $addToSet: "$value" }
                                }
                            },
                            {
                                $project: {
                                    name: "$_id",
                                    values: { $filter: { input: "$values", as: "v", cond: { $ne: ["$$v", null] } } },
                                    _id: 0
                                }
                            }
                        ],
                        price: [
                            {
                                $group: {
                                    _id: null,
                                    min: { $min: { $ifNull: ["$precio", { $min: "$variants.precio" }] } },
                                    max: { $max: { $ifNull: ["$precio", { $max: "$variants.precio" }] } },
                                },
                            },
                        ],
                    }
                }
            ];

            const [productsResult, countResult, filtersResult] = await Promise.all([
                Product.aggregate(productsPipeline),
                Product.aggregate(countPipeline),
                Product.aggregate(filtersPipeline)
            ]);

            const rawProducts = productsResult;
            const totalProducts = countResult.length > 0 ? countResult[0].total : 0;

            // ✅ CORRECCIÓN AQUÍ: Extraemos el objeto del array.
            // MongoDB $facet siempre retorna un array con 1 documento.
            // Si filtersResult es [{ brands: [], ... }], filters será { brands: [], ... }
            const filters = filtersResult.length > 0 ? filtersResult[0] : {};

            // =================================================================================
            // 🖼️ LÓGICA DE PROCESAMIENTO DE IMÁGENES
            // =================================================================================

            const processedProducts = rawProducts.map((product: any) => {
                if (Object.keys(activeFilters).length === 0 || !product.variants || product.variants.length === 0) {
                    return product;
                }

                const matchedVariant = product.variants.find((variant: any) => {
                    return Object.keys(activeFilters).some((filterKey) => {
                        const variantAttrValue = variant.atributos ? variant.atributos[filterKey] : null;
                        return variantAttrValue && activeFilters[filterKey].includes(variantAttrValue);
                    });
                });

                if (matchedVariant && matchedVariant.imagenes && matchedVariant.imagenes.length > 0) {
                    const mainImages = product.imagenes || [];
                    const variantImages = matchedVariant.imagenes;
                    const uniqueMainImages = mainImages.filter((img: string) => !variantImages.includes(img));

                    return {
                        ...product,
                        imagenes: [...variantImages, ...uniqueMainImages],
                        matchedVariantId: matchedVariant._id
                    };
                }

                return product;
            });

            // =================================================================================

            let finalProducts = processedProducts;
            let isFallback = false;

            if (rawProducts.length === 0 && pageNum === 1) {
                isFallback = true;
                finalProducts = await Product.aggregate([
                    { $match: { isActive: true, stock: { $gt: 0 } } },
                    { $sort: { createdAt: -1 } },
                    { $limit: 4 },
                    {
                        $lookup: {
                            from: "brands",
                            localField: "brand",
                            foreignField: "_id",
                            as: "brand"
                        }
                    },
                    { $unwind: { path: "$brand", preserveNullAndEmptyArrays: true } }
                ]);
            }

            res.status(200).json({
                products: finalProducts,
                totalPages: isFallback ? 1 : Math.ceil(totalProducts / limitNum),
                currentPage: pageNum,
                totalProducts: finalProducts.length, // Ojo: Si es fallback, muestra length de fallback, si prefieres mostrar 0 usa totalProducts
                // ✅ Ahora enviamos 'filters' como objeto, coincidiendo con filterSchema.optional()
                filters: filters,
            });

        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error fetching main page products" });
            return;
        }
    }



    static async getOffers(req: Request, res: Response) {
        console.log("Fetching offer products...");
        try {
            console.log("Query parameters:", req.query);
            const { page = '1', limit = '10' } = req.query as {
                page?: string;
                limit?: string;
            };
            const pageNum = parseInt(page, 10);
            const limitNum = parseInt(limit, 10);
            const skip = (pageNum - 1) * limitNum;
            const products = await Product.find({ precioComparativo: { $gt: 0 } })
                .skip(skip)
                .limit(limitNum)
                .sort({ createdAt: -1 })
                .populate('brand', 'nombre slug')
            // .populate('categoria', 'nombre slug');
            const totalProducts = await Product.countDocuments({ precioComparativo: { $gt: 0 } });
            if (products.length === 0) {
                res.status(404).json({ message: 'No se encontraron productos en oferta' });
                return;
            }
            res.status(200).json({
                products,
                totalPages: Math.ceil(totalProducts / limitNum),
                currentPage: pageNum,
                totalProducts
            });
        } catch (error) {
            console.error("Error fetching offer products:", error);
            res.status(500).json({ message: 'Error fetching offer products' });
            return;
        }
    }

}