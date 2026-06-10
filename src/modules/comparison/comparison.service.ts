// comparison.service.ts

import Comparison, { IComparison } from './comparison.model';
import Product from '../../models/Product';
import { AppError } from '../../utils/AppError';
import { Types } from 'mongoose';
import slugify from 'slugify';

export class ComparisonService {

    // ── Helpers privados ──────────────────────────────────

    private static generateSlug(title: string): string {
        return slugify(title, { lower: true, strict: true });
    }

    private static async validateProducts(ids: string[]): Promise<void> {
        const unique = [...new Set(ids)];
        if (unique.length < 2) {
            throw new AppError('Se requieren al menos 2 productos.', 400);
        }

        const found = await Product.countDocuments({
            _id: { $in: unique },
            isActive: true,
            deletedAt: null
        });

        if (found !== unique.length) {
            throw new AppError('Uno o más productos no existen o están inactivos.', 400);
        }
    }

    private static toObjectIds(ids: string[]): Types.ObjectId[] {
        return [...new Set(ids)].map(id => new Types.ObjectId(id));
    }

    // ── CRUD ──────────────────────────────────────────────

    static async create(data: Partial<IComparison>) {
        if (!data.title) throw new AppError('El título es requerido.', 400);

        data.slug = data.slug
            ? slugify(data.slug, { lower: true, strict: true })
            : this.generateSlug(data.title);

        const exists = await Comparison.exists({ slug: data.slug, deletedAt: null });
        if (exists) throw new AppError(`El slug '${data.slug}' ya está en uso.`, 400);

        const productIds = (data.products ?? []).map(p => p.toString());
        await this.validateProducts(productIds);
        data.products = this.toObjectIds(productIds);

        return Comparison.create(data);
    }

    static async getAll(filters: {
        isActive?: boolean;
        isFeatured?: boolean;
        search?: string;
        page?: number;
        limit?: number;
    } = {}) {
        const { isActive, isFeatured, search, page = 1, limit = 10 } = filters;

        const query: Record<string, unknown> = { deletedAt: null };
        if (isActive !== undefined)   query.isActive   = isActive;
        if (isFeatured !== undefined) query.isFeatured = isFeatured;
        if (search?.trim()) {
            query.$or = [
                { title: new RegExp(search, 'i') },
                { veredictoRapido: new RegExp(search, 'i') }
            ];
        }

        const [data, total] = await Promise.all([
            Comparison.find(query)
                .populate('products', 'nombre slug imagenes precio rating')
                .sort({ isFeatured: -1, createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            Comparison.countDocuments(query)
        ]);

        return { data, total, page, pages: Math.ceil(total / limit) };
    }

    static async getBySlug(slug: string) {
        const comparison = await Comparison.findOne({ slug, isActive: true, deletedAt: null })
            .populate('products', 'nombre slug imagenes precio rating brand')
            .lean();

        if (!comparison) throw new AppError('Comparativa no encontrada.', 404);

        // Incrementa viewCount sin bloquear la respuesta
        Comparison.updateOne({ slug }, { $inc: { viewCount: 1 } }).exec();

        return comparison;
    }

    static async getById(id: string) {
        if (!Types.ObjectId.isValid(id)) throw new AppError('ID inválido.', 400);

        const comparison = await Comparison.findOne({ _id: id, deletedAt: null })
            .populate('products', 'nombre slug imagenes precio rating brand isActive')
            .lean();

        if (!comparison) throw new AppError('Comparativa no encontrada.', 404);

        return comparison;
    }

    static async update(id: string, data: Partial<IComparison>) {
        if (!Types.ObjectId.isValid(id)) throw new AppError('ID inválido.', 400);

        // Slug: regenerar si cambia el título
        if (data.title && !data.slug) {
            data.slug = this.generateSlug(data.title);
        } else if (data.slug) {
            data.slug = slugify(data.slug, { lower: true, strict: true });
        }

        if (data.slug) {
            const conflict = await Comparison.exists({
                slug: data.slug,
                _id: { $ne: id },
                deletedAt: null
            });
            if (conflict) throw new AppError('El slug ya está en uso.', 400);
        }

        if (data.products?.length) {
            const productIds = data.products.map(p => p.toString());
            await this.validateProducts(productIds);
            data.products = this.toObjectIds(productIds);
        }

        const updated = await Comparison.findOneAndUpdate(
            { _id: id, deletedAt: null },
            data,
            { new: true, runValidators: true }
        ).lean();

        if (!updated) throw new AppError('Comparativa no encontrada.', 404);

        return updated;
    }

    static async delete(id: string) {
        if (!Types.ObjectId.isValid(id)) throw new AppError('ID inválido.', 400);

        const deleted = await Comparison.findOneAndUpdate(
            { _id: id, deletedAt: null },
            { deletedAt: new Date(), isActive: false },
            { new: true }
        ).lean();

        if (!deleted) throw new AppError('Comparativa no encontrada.', 404);

        return deleted;
    }

    static async getRelatedToProduct(productId: string, limit = 5) {
        if (!Types.ObjectId.isValid(productId)) {
            throw new AppError('ID de producto inválido.', 400);
        }

        return Comparison.find({
            products: new Types.ObjectId(productId),
            isActive: true,
            deletedAt: null
        })
            .select('title slug metaDescription viewCount createdAt')
            .sort({ isFeatured: -1, viewCount: -1 })
            .limit(limit)
            .lean();
    }
}