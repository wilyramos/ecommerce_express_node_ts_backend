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
            .select('_id productId nombre slug sku precio stock isActive imagenes variants')
            .limit(limit)
            .lean();
    }

    // NUEVO MÉTODO
    async findById(id: string): Promise<IProduct | null> {
        return await ProductModel.findById(id)
            .populate('categoria brand line') // Opcional: Para cargar relaciones si las usas
            .lean();
    }
}