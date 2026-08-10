// backend/src/modules/product/repositories/product.repository.ts
import ProductModel, { IProduct } from '../../../models/Product';
import { IProductRepository } from './product.repository.interface';

export class ProductRepository implements IProductRepository {
    async searchForAdmin(term: string, limit: number): Promise<Partial<IProduct>[]> {
        const regex = new RegExp(term, 'i');

        return await ProductModel.find({
            $or: [
                { nombre: regex },
                { productId: regex },
                { sku: regex },
                { barcode: regex },
                { 'variants.sku': regex },
                { 'variants.barcode': regex },
                { 'variants.nombre': regex }
            ]
        })
            // IMPORTANTE: Asegúrate de incluir 'imagenes' aquí para que el frontend las reciba
            .select('_id productId nombre slug sku precio stock isActive imagenes variants')
            .limit(limit)
            .lean();
    }
}