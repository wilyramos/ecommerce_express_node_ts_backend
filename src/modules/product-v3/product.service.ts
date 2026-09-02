// backend/src/modules/product/product.service.ts
import { IProductRepository } from './repositories/product.repository.interface';
import { AppError } from '../../utils/AppError';

export class ProductService {
    constructor(private readonly productRepository: IProductRepository) {}

    async searchAdmin(term: string, limitStr: string) {
        console.log('[ProductService.searchAdmin] Input recibido:', { term, limitStr });

        if (!term || typeof term !== 'string' || term.trim().length === 0) {
            console.warn('[ProductService.searchAdmin] Validación fallida: término inválido');
            throw new AppError('El término de búsqueda es inválido', 400);
        }

        const parsedLimit = parseInt(limitStr, 10);
        const limit = isNaN(parsedLimit) || parsedLimit <= 0 ? 10 : parsedLimit;
        const maxLimit = limit > 50 ? 50 : limit;

        console.log('[ProductService.searchAdmin] Parámetros normalizados:', { 
            term: term.trim(), 
            rawLimit: limitStr, 
            finalLimit: maxLimit 
        });

        return await this.productRepository.searchForAdmin(term.trim(), maxLimit);
    }
}