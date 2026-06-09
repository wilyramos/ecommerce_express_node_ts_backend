// backend/src/modules/comparison/comparison.service.ts
import Comparison, { IComparison } from './comparison.model';
import Product from '../../models/Product';
import { AppError } from '../../utils/AppError';
import { Types } from 'mongoose';
import slugify from 'slugify';

export class ComparisonService {
    /**
     * Crea una comparativa optimizada para conversión visual con validaciones de scores.
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

        const uniqueIds: string[] = Array.from(new Set(data.products.map(p => p.toString())));
        const dbProducts = await Product.find({ _id: { $in: uniqueIds }, isActive: true, deletedAt: null }).select('_id nombre');

        if (dbProducts.length !== uniqueIds.length) {
            throw new AppError('Uno o más productos no existen o están inactivos.', 400);
        }

        data.products = uniqueIds.map((id: string) => new Types.ObjectId(id));

        if (!data.veredictoRapido || data.veredictoRapido.trim().length < 20) {
            throw new AppError('El veredicto rápido es obligatorio y debe ser directo para el cliente.', 400);
        }

        // Validación estricta de las puntuaciones numéricas para los gráficos interactivos
        if (data.analisisEditorial) {
            for (const ed of data.analisisEditorial) {
                if (ed.scores && ed.scores.length > 0) {
                    for (const scoreItem of ed.scores) {
                        if (scoreItem.score < 0 || scoreItem.score > 100) {
                            throw new AppError(`El puntaje para el criterio '${scoreItem.criterion}' debe estar estrictamente entre 0 y 100.`, 400);
                        }
                    }
                }
            }
        }

        if (!data.metaTitle) {
            data.metaTitle = `${dbProducts.map(p => p.nombre).join(' vs ')} - Comparativa Directa`;
        }
        if (!data.metaDescription) {
            data.metaDescription = data.veredictoRapido.substring(0, 155).trim().concat('...');
        }

        return await new Comparison(data).save();
    }

    /**
     * Obtiene el listado paginado con proyección limpia de los productos implicados.
     */
    static async getAll(filters: { isActive?: boolean; isFeatured?: boolean; search?: string; limit?: number; page?: number } = {}) {
        const { isActive, isFeatured, search, limit = 10, page = 1 } = filters;
        const query: any = { deletedAt: null };

        if (isActive !== undefined) query.isActive = isActive;
        if (isFeatured !== undefined) query.isFeatured = isFeatured;

        if (search?.trim()) {
            const regex = new RegExp(search, 'i');
            query.$or = [{ title: regex }, { veredictoRapido: regex }];
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
     * Recupera la comparativa por slug inyectando datos limpios listos para tablas y gráficos.
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
            .populate({ path: 'analisisEditorial.product', select: 'nombre slug imagenes precio' });

        if (!comparison) {
            throw new AppError('La comparativa solicitada no se encuentra disponible.', 404);
        }

        if (isPublic) {
            Comparison.findByIdAndUpdate(comparison._id, { $inc: { viewCount: 1 } }).catch(() => { });
        }

        return comparison;
    }

    /**
     * Recupera una comparativa por su ID único para paneles de administración.
     */
    static async getById(id: string) {
        if (!Types.ObjectId.isValid(id)) {
            throw new AppError('ID de comparativa inválido.', 400);
        }

        const comparison = await Comparison.findOne({ _id: id, deletedAt: null })
            .populate({
                path: 'products',
                select: 'nombre slug imagenes precio precioComparativo stock rating numReviews brand isActive',
                populate: { path: 'brand', select: 'nombre logo' }
            })
            .populate({ path: 'analisisEditorial.product', select: 'nombre slug imagenes precio' });

        if (!comparison) {
            throw new AppError('La comparativa no existe.', 404);
        }

        return comparison;
    }

    /**
     * Actualiza la comparativa manteniendo consistencia en scores y simplificación de textos.
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
            const uniqueIds: string[] = Array.from(new Set(data.products.map(p => p.toString())));
            const dbProducts = await Product.find({ _id: { $in: uniqueIds }, isActive: true, deletedAt: null }).select('_id nombre');

            if (dbProducts.length !== uniqueIds.length) {
                throw new AppError('Uno o más productos no existen o están inactivos.', 400);
            }
            data.products = uniqueIds.map((id: string) => new Types.ObjectId(id));
        }

        if (data.analisisEditorial) {
            for (const ed of data.analisisEditorial) {
                if (ed.scores && ed.scores.length > 0) {
                    for (const scoreItem of ed.scores) {
                        if (scoreItem.score < 0 || scoreItem.score > 100) {
                            throw new AppError(`El puntaje para el criterio '${scoreItem.criterion}' debe estar estrictamente entre 0 y 100.`, 400);
                        }
                    }
                }
            }
        }

        if (data.veredictoRapido !== undefined && data.veredictoRapido.trim().length < 20) {
            throw new AppError('El veredicto rápido no puede estar vacío y debe ser directo.', 400);
        }

        const comparison = await Comparison.findByIdAndUpdate(id, data, { new: true, runValidators: true });
        if (!comparison) throw new AppError('Error al actualizar la comparativa.', 404);

        return comparison;
    }

    /**
     * Ejecuta el borrado lógico.
     */
    static async delete(id: string) {
        if (!Types.ObjectId.isValid(id)) throw new AppError('ID inválido.', 400);

        const deleted = await Comparison.findByIdAndUpdate(id, { deletedAt: new Date(), isActive: false }, { new: true });
        if (!deleted) throw new AppError('Comparativa no encontrada.', 404);

        return deleted;
    }

    /**
     * Busca comparativas vinculadas directamente a un producto para cross-selling comercial.
     */
    static async getRelatedToProduct(productId: string, limit: number = 5) {
        if (!Types.ObjectId.isValid(productId)) throw new AppError('ID de producto inválido.', 400);

        return await Comparison.find({ products: new Types.ObjectId(productId), isActive: true, deletedAt: null })
            .select('title slug metaDescription ctaConfig createdAt viewCount')
            .limit(limit)
            .sort({ isFeatured: -1, viewCount: -1 })
            .lean();
    }
}