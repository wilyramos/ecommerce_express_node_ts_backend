import Comparison, { IComparison } from './comparison.model';
import Product from '../../models/Product';
import { AppError } from '../../utils/AppError';
import { Types } from 'mongoose';
import slugify from 'slugify';

export class ComparisonService {
    /**
     * Crea una comparativa con validaciones esenciales de SEO e integridad de productos.
     */
    static async create(data: Partial<IComparison>) {
        if (!data.slug && data.title) {
            data.slug = slugify(data.title, { lower: true, strict: true });
        }

        if (!data.slug) {
            throw new AppError('El título es requerido para generar el slug.', 400);
        }

        const existingSlug = await Comparison.findOne({ slug: data.slug, deletedAt: null });
        if (existingSlug) {
            throw new AppError(`El slug '${data.slug}' ya existe.`, 400);
        }

        if (!data.products || data.products.length < 2) {
            throw new AppError('Se requieren al menos 2 productos para la comparativa.', 400);
        }

        // SOLUCIÓN: Definición explícita de tipos para evitar inferencias 'unknown'
        const uniqueIds: string[] = Array.from(new Set(data.products.map(p => p.toString())));
        const dbProducts = await Product.find({ _id: { $in: uniqueIds }, isActive: true, deletedAt: null }).select('_id nombre');

        if (dbProducts.length !== uniqueIds.length) {
            throw new AppError('Uno o más productos no existen o están inactivos.', 400);
        }

        // SOLUCIÓN: Tipado explícito de (id: string) en la instanciación de ObjectId
        data.products = uniqueIds.map((id: string) => new Types.ObjectId(id));

        if (!data.introduccion || data.introduccion.trim().length < 150) {
            throw new AppError('La introducción debe tener al menos 150 caracteres para SEO.', 400);
        }
        if (!data.conclusion || data.conclusion.trim().length < 150) {
            throw new AppError('La conclusión debe tener al menos 150 caracteres para SEO.', 400);
        }

        if (!data.metaTitle) {
            data.metaTitle = `${dbProducts.map(p => p.nombre).join(' vs ')} - Comparativa`;
        }
        if (!data.metaDescription) {
            data.metaDescription = data.introduccion.substring(0, 155).trim().concat('...');
        }

        return await new Comparison(data).save();
    }

    /**
     * Obtiene listado paginado con soporte de búsqueda.
     */
    static async getAll(filters: { isActive?: boolean; isFeatured?: boolean; search?: string; limit?: number; page?: number } = {}) {
        const { isActive, isFeatured, search, limit = 10, page = 1 } = filters;
        const query: any = { deletedAt: null };

        if (isActive !== undefined) query.isActive = isActive;
        if (isFeatured !== undefined) query.isFeatured = isFeatured;

        if (search?.trim()) {
            const regex = new RegExp(search, 'i');
            query.$or = [{ title: regex }, { introduccion: regex }, { palabrasClaveSecundarias: regex }];
        }

        const [comparisons, total] = await Promise.all([
            Comparison.find(query)
                .populate({ path: 'products', select: 'nombre slug imagenes precio stock rating' })
                .skip((page - 1) * limit)
                .limit(limit)
                .sort({ isFeatured: -1, createdAt: -1 }),
            Comparison.countDocuments(query)
        ]);

        return { comparisons, total, page, pages: Math.ceil(total / limit) };
    }

    /**
     * Recupera una comparativa por slug.
     */
    static async getBySlug(slug: string, isPublic: boolean = true) {
        const query: any = { slug, deletedAt: null };
        if (isPublic) query.isActive = true;

        const comparison = await Comparison.findOne(query)
            .populate({
                path: 'products',
                select: 'nombre slug imagenes precio precioComparativo stock rating numReviews brand isActive',
                populate: { path: 'brand', select: 'nombre logo' }
            })
            .populate({ path: 'analisisEditorial.product', select: 'nombre slug imagenes' });

        if (!comparison) {
            throw new AppError('La comparativa no existe o no está activa.', 404);
        }

        if (isPublic) {
            Comparison.findByIdAndUpdate(comparison._id, { $inc: { viewCount: 1 } }).catch(() => { });
        }

        return comparison;
    }

    /**
     * Recupera una comparativa por su ID único.
     */
    static async getById(id: string) {
        if (!Types.ObjectId.isValid(id)) {
            throw new AppError('ID de comparativa inválido.', 400);
        }

        const comparison = await Comparison.findOne({ _id: id, deletedAt: null })
            .populate({
                path: 'products',
                select: 'nombre slug imagenes precio precioComparativo stock rating numReviews brand isActive descripcion',
                populate: { path: 'brand', select: 'nombre logo' }
            })
            .populate({ path: 'analisisEditorial.product', select: 'nombre slug imagenes precio' });

        if (!comparison) {
            throw new AppError('La comparativa solicitada no existe.', 404);
        }

        return comparison;
    }

    /**
     * Actualiza la comparativa replicando las restricciones de negocio y SEO de la creación.
     */
    static async update(id: string, data: Partial<IComparison>) {
        if (!Types.ObjectId.isValid(id)) throw new AppError('ID inválido.', 400);

        const current = await Comparison.findOne({ _id: id, deletedAt: null });
        if (!current) throw new AppError('Comparativa no encontrada.', 404);

        if (data.title && !data.slug) {
            data.slug = slugify(data.title, { lower: true, strict: true });
        } else if (data.slug) {
            data.slug = slugify(data.slug, { lower: true, strict: true });
        }

        if (data.slug) {
            const exists = await Comparison.findOne({ slug: data.slug, _id: { $ne: id }, deletedAt: null });
            if (exists) throw new AppError('El slug ya está en uso.', 400);
        }

        if (data.products) {
            if (data.products.length < 2) {
                throw new AppError('Se requieren al menos 2 productos para la comparativa.', 400);
            }

            // SOLUCIÓN: Definición explícita de tipos también en el método de actualización
            const uniqueIds: string[] = Array.from(new Set(data.products.map(p => p.toString())));
            const dbProducts = await Product.find({ _id: { $in: uniqueIds }, isActive: true, deletedAt: null }).select('_id nombre');

            if (dbProducts.length !== uniqueIds.length) {
                throw new AppError('Uno o más productos no existen o están inactivos.', 400);
            }
            data.products = uniqueIds.map((id: string) => new Types.ObjectId(id));

            if (!data.metaTitle) {
                data.metaTitle = `${dbProducts.map(p => p.nombre).join(' vs ')} - Comparativa`;
            }
        }

        if (data.introduccion !== undefined && data.introduccion.trim().length < 150) {
            throw new AppError('La introducción debe tener al menos 150 caracteres para SEO.', 400);
        }
        if (data.conclusion !== undefined && data.conclusion.trim().length < 150) {
            throw new AppError('La conclusión debe tener al menos 150 caracteres para SEO.', 400);
        }

        if (data.introduccion && !data.metaDescription) {
            data.metaDescription = data.introduccion.substring(0, 155).trim().concat('...');
        }

        const comparison = await Comparison.findByIdAndUpdate(id, data, { new: true, runValidators: true });
        if (!comparison) throw new AppError('Comparativa no encontrada durante la actualización.', 404);

        return comparison;
    }

    /**
     * Borrado lógico.
     */
    static async delete(id: string) {
        if (!Types.ObjectId.isValid(id)) throw new AppError('ID inválido.', 400);

        const deleted = await Comparison.findByIdAndUpdate(id, { deletedAt: new Date(), isActive: false }, { new: true });
        if (!deleted) throw new AppError('Comparativa no encontrada.', 404);

        return deleted;
    }

    /**
     * Comparativas relacionadas a una ficha de producto.
     */
    static async getRelatedToProduct(productId: string, limit: number = 5) {
        if (!Types.ObjectId.isValid(productId)) throw new AppError('ID de producto inválido.', 400);

        return await Comparison.find({ products: new Types.ObjectId(productId), isActive: true, deletedAt: null })
            .select('title slug metaDescription createdAt viewCount')
            .limit(limit)
            .sort({ isFeatured: -1, viewCount: -1 })
            .lean();
    }
}