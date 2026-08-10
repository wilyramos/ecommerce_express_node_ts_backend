// backend/src/modules/product/repositories/product.repository.interface.ts
import { IProduct } from '../../../models/Product';

export interface IProductRepository {
    searchForAdmin(term: string, limit: number): Promise<Partial<IProduct>[]>;
}