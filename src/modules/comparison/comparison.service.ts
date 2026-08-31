// backend/src/modules/comparison/comparison.service.ts

import { AppError } from '../../utils/AppError';
import { IComparisonRepository } from './repositories/comparison.repository.interface';
import { ComparisonRepository } from './repositories/comparison.repository';
import { IComparison } from './comparison.model';

export class ComparisonService {
    constructor(private readonly comparisonRepository: IComparisonRepository) {}

    private generateSlug(title: string): string {
        return title
            .toLowerCase()
            .trim()
            .replace(/[\s\W-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    private validateBusinessRules(data: Partial<IComparison>) {
        if (data.products && data.products.length < 2) {
            throw new AppError('Se requieren al menos 2 productos para una comparativa.', 400);
        }

        if (data.especificaciones && data.products) {
            const productCount = data.products.length;
            data.especificaciones.forEach((spec, index) => {
                if (spec.values.length !== productCount) {
                    throw new AppError(
                        `La especificación '${spec.key || index}' debe tener exactamente ${productCount} valores (uno por producto).`,
                        400
                    );
                }
                if (spec.scores.length !== productCount) {
                    throw new AppError(
                        `La especificación '${spec.key || index}' debe tener exactamente ${productCount} puntuaciones (una por producto).`,
                        400
                    );
                }
            });
        }
    }

    async createComparison(data: Partial<IComparison>) {
        if (!data.slug && data.title) {
            data.slug = this.generateSlug(data.title);
        }

        if (!data.slug) {
            throw new AppError('El título es obligatorio para generar el slug.', 400);
        }

        const existing = await this.comparisonRepository.findBySlug(data.slug);
        if (existing) {
            throw new AppError('Ya existe una comparativa con este slug.', 400);
        }

        this.validateBusinessRules(data);

        return await this.comparisonRepository.create(data);
    }

    async updateComparison(id: string, data: Partial<IComparison>) {
        if (data.title && !data.slug) {
            data.slug = this.generateSlug(data.title);
        }

        if (data.slug) {
            const existing = await this.comparisonRepository.findBySlug(data.slug);
            if (existing && existing._id.toString() !== id) {
                throw new AppError('El slug generado o provisto ya está en uso por otra comparativa.', 400);
            }
        }

        const currentComparison = await this.comparisonRepository.findById(id);
        if (!currentComparison) {
            throw new AppError('Comparativa no encontrada', 404);
        }

        const mergedData = {
            ...currentComparison.toObject(),
            ...data,
        };

        this.validateBusinessRules(mergedData);

        const updated = await this.comparisonRepository.update(id, data);
        if (!updated) {
            throw new AppError('Error al actualizar la comparativa', 500);
        }

        return updated;
    }

    async getComparisonBySlug(slug: string, recordView: boolean = false) {
        const comparison = await this.comparisonRepository.findBySlug(slug);
        if (!comparison) {
            throw new AppError('Comparativa no encontrada', 404);
        }

        if (recordView) {
            this.comparisonRepository.incrementViewCount(comparison._id.toString()).catch(() => {});
        }

        return comparison;
    }

    async getComparisonById(id: string) {
        const comparison = await this.comparisonRepository.findById(id);
        if (!comparison) {
            throw new AppError('Comparativa no encontrada', 404);
        }
        return comparison;
    }

    async getAllComparisons(page = 1, limit = 10, search = '', activeOnly = false) {
        const query: any = {};

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { slug: { $regex: search, $options: 'i' } },
            ];
        }

        if (activeOnly) {
            query.isActive = true;
        }

        const { data, total } = await this.comparisonRepository.findAllPaginated(query, page, limit);
        return { data, total, page, limit };
    }

    async getComparisonsByProduct(productId: string) {
        return await this.comparisonRepository.findByProductId(productId);
    }

    async toggleStatus(id: string) {
        const comparison = await this.getComparisonById(id);
        return await this.comparisonRepository.update(id, { isActive: !comparison.isActive });
    }

    async toggleFeatured(id: string) {
        const comparison = await this.getComparisonById(id);
        return await this.comparisonRepository.update(id, { isFeatured: !comparison.isFeatured });
    }

    async deleteComparison(id: string) {
        const deleted = await this.comparisonRepository.softDelete(id);
        if (!deleted) {
            throw new AppError('Comparativa no encontrada', 404);
        }
        return deleted;
    }
}

export const comparisonService = new ComparisonService(new ComparisonRepository());