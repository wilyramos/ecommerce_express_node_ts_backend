// File: backend/src/modules/page/page.service.ts

import { UpdateQuery, Types } from 'mongoose';
import { Page, IPage } from './page.model';
import { AppError } from '../../utils/AppError';
import slugify from 'slugify';

const RESERVED_SLUGS = [
    "admin", "api", "pos", "staff", "auth", "carrito", "catalogo", 
    "categorias", "checkout", "checkout-result", "colecciones", 
    "libro-de-reclamaciones", "novedades", "ofertas", "productos", 
    "profile", "search", "track-order", "login", "registro", "perfil"
];

const IMMUTABLE_SLUGS = ["terminos-y-condiciones", "cambios-devoluciones"];

export class PageService {

    async getPageBySlug(slug: string): Promise<IPage> {
        const page = await Page.findOne({ slug, isActive: true }).lean();
        if (!page) {
            throw new AppError('La página solicitada no está disponible o no existe.', 404);
        }
        return page as IPage;
    }

    async getAllPages(page: number = 1, limit: number = 10): Promise<{
        data: IPage[];
        meta: { total: number; page: number; pages: number; limit: number }
    }> {
        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            Page.find()
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Page.countDocuments()
        ]);

        const pages = Math.ceil(total / limit);

        return {
            data: data as IPage[],
            meta: { total, page, pages, limit }
        };
    }

    async getPageById(id: string): Promise<IPage> {
        if (!Types.ObjectId.isValid(id)) {
            throw new AppError('El identificador de página provisto tiene un formato inválido.', 400);
        }

        const page = await Page.findById(id).lean();
        if (!page) {
            throw new AppError('La página solicitada no existe.', 404);
        }
        return page as IPage;
    }

    async createPage(pageData: Partial<IPage>): Promise<IPage> {
        if (!pageData.title) {
            throw new AppError('El título de la página es obligatorio.', 400);
        }

        const baseText = pageData.slug || pageData.title;
        pageData.slug = slugify(baseText, { lower: true, strict: true, trim: true, locale: "es" });

        if (RESERVED_SLUGS.includes(pageData.slug.toLowerCase().trim())) {
            throw new AppError(`La ruta '/${pageData.slug}' está protegida porque corresponde a una sección crítica del e-commerce.`, 400);
        }

        await this.checkSlugUniqueness(pageData.slug);

        const newPage = new Page(pageData);
        return await newPage.save();
    }

    async updatePage(id: string, updateData: UpdateQuery<IPage>): Promise<IPage> {
        if (!Types.ObjectId.isValid(id)) {
            throw new AppError('El identificador de página provisto tiene un formato inválido.', 400);
        }

        const currentPage = await Page.findById(id).lean();
        if (!currentPage) {
            throw new AppError('No se localizó la página para aplicar la actualización.', 404);
        }

        if (updateData.slug || updateData.title) {
            const baseText = updateData.slug || updateData.title;
            const newSlug = slugify(baseText, { lower: true, strict: true, trim: true, locale: "es" });

            if (IMMUTABLE_SLUGS.includes(currentPage.slug) && newSlug !== currentPage.slug) {
                throw new AppError(`No está permitido modificar la ruta (slug) de la página legal obligatoria '/${currentPage.slug}'.`, 400);
            }

            if (RESERVED_SLUGS.includes(newSlug.toLowerCase().trim())) {
                throw new AppError(`La ruta '/${newSlug}' corresponde a una sección reservada de la plataforma e-commerce.`, 400);
            }

            updateData.slug = newSlug;
            await this.checkSlugUniqueness(newSlug, id);
        }

        const updatedPage = await Page.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        return updatedPage!;
    }

    async deletePage(id: string): Promise<IPage> {
        if (!Types.ObjectId.isValid(id)) {
            throw new AppError('El identificador de página provisto tiene un formato inválido.', 400);
        }

        const page = await Page.findById(id).lean();
        if (!page) {
            throw new AppError('No se encontró la página seleccionada para remover.', 404);
        }

        if (IMMUTABLE_SLUGS.includes(page.slug)) {
            throw new AppError(`La página '/${page.slug}' es vital para el cumplimiento legal del e-commerce y no puede ser eliminada.`, 400);
        }

        const deletedPage = await Page.findByIdAndDelete(id);
        return deletedPage!;
    }

    private async checkSlugUniqueness(slug: string, excludeId?: string): Promise<void> {
        const query: Record<string, any> = { slug };
        if (excludeId) {
            query._id = { $ne: new Types.ObjectId(excludeId) };
        }

        const exists = await Page.findOne(query).select('_id').lean();
        if (exists) {
            throw new AppError('El slug generado o provisto ya se encuentra registrado por otra página.', 400);
        }
    }
}