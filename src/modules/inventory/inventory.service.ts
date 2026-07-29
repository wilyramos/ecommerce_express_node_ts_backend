// File: backend/src/modules/inventory/inventory.service.ts

import Product from '../../models/Product';
import { InventoryLog } from './inventory.model';
import { AppError } from '../../utils/AppError';

export interface InventoryFilterOptions {
    search?: string;
    filter?: 'low' | 'out' | 'all';
    page?: number;
    limit?: number;
}

export interface AdjustStockDTO {
    productId: string;
    variantId?: string;
    newStock: number;
    reason: string;
    actionBy: string;
}

export const inventoryService = {
    async getInventory(options: InventoryFilterOptions) {
        const { search, filter = 'all', page = 1, limit = 10 } = options;

        let query: any = { deletedAt: null };

        if (search) {
            query.$or = [
                { nombre: { $regex: search, $options: 'i' } },
                { sku: { $regex: search, $options: 'i' } },
                { barcode: { $regex: search, $options: 'i' } },
                { 'variants.sku': { $regex: search, $options: 'i' } },
                { 'variants.barcode': { $regex: search, $options: 'i' } },
            ];
        }

        const products = await Product.find(query).select(
            'nombre sku barcode stock precio imagenes variants isActive'
        );

        let inventoryItems: any[] = [];

        products.forEach((prod: any) => {
            // Si el producto cuenta con variantes registradas en prod.variants
            if (prod.variants && prod.variants.length > 0) {
                prod.variants.forEach((v: any) => {
                    const stock = v.stock ?? 0;

                    if (filter === 'low' && stock > 5) return;
                    if (filter === 'out' && stock > 0) return;

                    // Mapeo plano de atributos (Map / Record)
                    let attributesText = '';
                    if (v.atributos) {
                        if (v.atributos instanceof Map) {
                            attributesText = Array.from(v.atributos.values()).join(' / ');
                        } else if (typeof v.atributos === 'object') {
                            attributesText = Object.values(v.atributos).join(' / ');
                        }
                    }

                    inventoryItems.push({
                        productId: prod._id,
                        variantId: v._id,
                        nombre: attributesText ? `${prod.nombre} — ${attributesText}` : (v.nombre || prod.nombre),
                        sku: v.sku || prod.sku || 'SIN SKU',
                        barcode: v.barcode || prod.barcode || '',
                        stock: stock,
                        price: v.precio ?? prod.precio ?? 0,
                        imagen: (v.imagenes && v.imagenes.length > 0) ? v.imagenes[0] : (prod.imagenes?.[0] || null),
                        isActive: prod.isActive,
                        hasVariants: true,
                    });
                });
            } else { // Producto simple sin variantes
                const stock = prod.stock ?? 0;

                if (filter === 'low' && stock > 5) return;
                if (filter === 'out' && stock > 0) return;

                inventoryItems.push({
                    productId: prod._id,
                    variantId: null,
                    nombre: prod.nombre,
                    sku: prod.sku || 'SIN SKU',
                    barcode: prod.barcode || '',
                    stock: stock,
                    price: prod.precio ?? 0,
                    imagen: prod.imagenes?.[0] || null,
                    isActive: prod.isActive,
                    hasVariants: false,
                });
            }
        });

        // Paginación manual sobre la lista resultante
        const total = inventoryItems.length;
        const startIndex = (page - 1) * limit;
        const paginatedData = inventoryItems.slice(startIndex, startIndex + limit);

        return {
            items: paginatedData,
            total,
            page,
            limit,
        };
    },

    async adjustStock(dto: AdjustStockDTO) {
        const { productId, variantId, newStock, reason, actionBy } = dto;

        if (newStock === undefined || isNaN(newStock) || newStock < 0) {
            throw new AppError('El valor de stock debe ser mayor o igual a 0.', 400);
        }

        const product = await Product.findById(productId);
        if (!product || product.deletedAt) {
            throw new AppError('Producto no encontrado o deshabilitado.', 404);
        }

        let previousStock = 0;

        if (variantId) {
            const variant = (product.variants as any).id(variantId);
            if (!variant) {
                throw new AppError('La variante de producto especificada no existe.', 404);
            }
            previousStock = variant.stock ?? 0;
            variant.stock = Number(newStock);
        } else {
            previousStock = product.stock ?? 0;
            product.stock = Number(newStock);
        }

        await product.save();

        const quantityChange = Number(newStock) - previousStock;

        // Registro de Auditoría
        const log = await InventoryLog.create({
            productId,
            variantId: variantId || undefined,
            type: 'adjustment',
            quantityChange,
            previousStock,
            newStock: Number(newStock),
            reason: reason || 'Ajuste manual de inventario en panel administrativo',
            actionBy,
        });

        return {
            productId,
            variantId: variantId || null,
            previousStock,
            newStock: Number(newStock),
            quantityChange,
            log,
        };
    },

    async getInventoryLogs(productId?: string, limit = 50) {
        let query: any = {};
        if (productId) {
            query.productId = productId;
        }

        return await InventoryLog.find(query)
            .populate('productId', 'nombre sku')
            .sort({ createdAt: -1 })
            .limit(limit);
    },
};