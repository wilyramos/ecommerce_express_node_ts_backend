// backend/src/modules/product/product.service.ts
import { IProductRepository } from './repositories/product.repository.interface';
import { AppError } from '../../utils/AppError';

export class ProductService {
    constructor(private readonly productRepository: IProductRepository) {}

    async searchAdmin(term: string, limitStr: string) {
        if (!term || term.trim().length === 0) {
            throw new AppError('El término de búsqueda es inválido', 400);
        }

        const limit = parseInt(limitStr, 10);
        const maxLimit = limit > 50 ? 50 : limit;

        return await this.productRepository.searchForAdmin(term.trim(), maxLimit);
    }
}