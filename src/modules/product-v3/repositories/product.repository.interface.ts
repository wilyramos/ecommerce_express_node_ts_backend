import { IProduct } from '../../../models/Product';

export interface IProductRepository {
    searchForAdmin(term: string, limit: number): Promise<Partial<IProduct>[]>;
    findById(id: string): Promise<IProduct | null>; // Nuevo método
}