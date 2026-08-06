// File: backend/src/modules/discount/discount.service.ts

import { ClientSession, FilterQuery } from 'mongoose';
import { DiscountType, DiscountAppliesVia, DiscountTarget, IDiscount } from './discount.model';
import Order from '../../models/Order';
import { AppError } from '../../utils/AppError';
import { getDiscountStrategy } from './strategies/discount-strategy.factory';
import { IDiscountRepository } from './repositories/discount.repository.interface';
import { DiscountRepository } from './repositories/discount.repository';
import { productService, ProductService } from '../product/product.service';

export interface ICartItemValidation {
    productId: string;
    variantId?: string;
    quantity: number;
    price: number;
}

export class DiscountService {
    constructor(
        private readonly discountRepository: IDiscountRepository,
        private readonly productService: ProductService
    ) { }

    // ── 1. EVALUACIÓN DE PROMOCIONES AUTOMÁTICAS (CARRITO) ──────────────────
    async evaluateAutomaticDiscounts(
        subtotal: number,
        cartItems: ICartItemValidation[]
    ) {
        if (!cartItems || cartItems.length === 0 || subtotal <= 0) {
            return { appliedDiscount: null, discountAmount: 0, newTotal: subtotal, itemDiscounts: [] };
        }

        const autoDiscounts = await this.discountRepository.findActiveAutomaticDiscounts();
        if (autoDiscounts.length === 0) {
            return { appliedDiscount: null, discountAmount: 0, newTotal: subtotal, itemDiscounts: [] };
        }

        let bestDiscountAmount = 0;
        let bestDiscount: IDiscount | null = null;
        const now = new Date();

        for (const discount of autoDiscounts) {
            try {
                // Validaciones estáticas de tiempo y capacidad
                if (now < discount.startDate) continue;
                if (discount.endDate && now > discount.endDate) continue;
                if (subtotal < discount.minPurchaseAmount) continue;
                if (discount.usageLimitTotal && discount.currentUsageCount >= discount.usageLimitTotal) continue;

                // Todos los productos son elegibles para evaluación (sin excluir los que tienen precioComparativo)
                const strategy = getDiscountStrategy(discount.type, discount.target);
                const calculatedAmount = await strategy.calculate(discount, subtotal, cartItems);

                // Algoritmo "Best-Discount Win"
                if (calculatedAmount > bestDiscountAmount) {
                    bestDiscountAmount = calculatedAmount;
                    bestDiscount = discount;
                }
            } catch {
                // Falla silenciosa esperada (ej: no se cumplen las unidades mínimas para el BXGY)
                continue;
            }
        }

        if (!bestDiscount || bestDiscountAmount === 0) {
            return { appliedDiscount: null, discountAmount: 0, newTotal: subtotal, itemDiscounts: [] };
        }

        // Distribución del descuento en los ítems (Para reflejo visual en UI)
        const discountMap = new Map<string, number>();
        let remainingDiscount = bestDiscountAmount;

        // Si es un descuento general (Porcentaje o Monto Fijo sobre el total) se distribuye proporcionalmente
        if (bestDiscount.type === DiscountType.PERCENTAGE || bestDiscount.type === DiscountType.FIXED_AMOUNT) {
            cartItems.forEach((item, index) => {
                const key = `${item.productId}-${item.variantId || 'base'}`;
                const itemTotal = item.price * item.quantity;
                
                // Si es el último ítem, se le asigna el remanente para evitar pérdida de centavos por redondeo
                let discountForItem = 0;
                if (index === cartItems.length - 1) {
                    discountForItem = Math.min(remainingDiscount, itemTotal);
                } else {
                    const proportion = itemTotal / subtotal;
                    discountForItem = Math.min(Number((bestDiscountAmount * proportion).toFixed(2)), itemTotal);
                }
                
                remainingDiscount -= discountForItem;
                discountMap.set(key, discountForItem);
            });
        } 
        // Si es BXGY, se usa distribución Greedy (los productos regalados son los más baratos de la lista de elegibles)
        else {
            const sortedItems = [...cartItems].sort((a, b) => a.price - b.price);
            
            sortedItems.forEach((item) => {
                const key = `${item.productId}-${item.variantId || 'base'}`;
                let discountForItem = 0;

                if (remainingDiscount > 0) {
                    const config = bestDiscount!.bxgyConfig;
                    const isTargetGift = !config?.getProducts || config.getProducts.length === 0
                        ? true
                        : config.getProducts.some((gp) => gp.toString() === item.productId);

                    if (isTargetGift) {
                        const maxPossible = item.price * item.quantity;
                        discountForItem = Math.min(maxPossible, remainingDiscount);
                    }
                    remainingDiscount -= discountForItem;
                }
                discountMap.set(key, discountForItem);
            });
        }

        const itemDiscounts = cartItems.map((item) => {
            const key = `${item.productId}-${item.variantId || 'base'}`;
            return {
                productId: item.productId,
                variantId: item.variantId,
                discountAmount: Number((discountMap.get(key) || 0).toFixed(2)),
            };
        });

        return {
            appliedDiscount: {
                id: bestDiscount._id.toString(),
                title: bestDiscount.title,
                type: bestDiscount.type,
                appliesVia: bestDiscount.appliesVia,
            },
            discountAmount: Number(bestDiscountAmount.toFixed(2)),
            newTotal: Number(Math.max(0, subtotal - bestDiscountAmount).toFixed(2)),
            itemDiscounts,
        };
    }

    // ── 2. VALIDACIÓN MANUAL POR CÓDIGO (CHECKOUT) ──────────────────────────
    async validateAndCalculateDiscount(
        code: string,
        subtotal: number,
        cartItems: ICartItemValidation[],
        userId?: string
    ) {
        if (!code || !code.trim()) throw new AppError('Debe ingresar un código de cupón.', 400);
        if (subtotal <= 0 || !cartItems.length) throw new AppError('El carrito no es válido para aplicar descuentos.', 400);

        const cleanCode = code.trim();
        const discount = await this.discountRepository.findActiveByCode(cleanCode);

        if (!discount) throw new AppError('El cupón ingresado no existe o no se encuentra activo.', 404);

        const now = new Date();
        if (now < discount.startDate) throw new AppError('Este cupón aún no está activo.', 400);
        if (discount.endDate && now > discount.endDate) throw new AppError('Este cupón ha expirado.', 400);

        if (subtotal < discount.minPurchaseAmount) {
            throw new AppError(`Para usar este cupón, la compra mínima debe ser de S/ ${discount.minPurchaseAmount.toFixed(2)}.`, 400);
        }

        if (discount.usageLimitTotal && discount.currentUsageCount >= discount.usageLimitTotal) {
            throw new AppError('Este cupón ha alcanzado el límite máximo de usos disponibles.', 400);
        }

        if (userId) {
            const userUsage = discount.usedBy.find((u) => u.userId.toString() === userId.toString());
            if (userUsage && userUsage.count >= discount.usageLimitPerCustomer) {
                throw new AppError('Ya has utilizado este cupón el máximo de veces permitido.', 400);
            }
        }

        let discountAmount = 0;
        let isFreeShipping = false;

        if (discount.type === DiscountType.FREE_SHIPPING) {
            isFreeShipping = true;
            discountAmount = 0;
        } else {
            const strategy = getDiscountStrategy(discount.type, discount.target);
            discountAmount = await strategy.calculate(discount, subtotal, cartItems);
        }

        discountAmount = Math.min(discountAmount, subtotal);

        return {
            id: discount._id.toString(),
            code: discount.code,
            title: discount.title,
            type: discount.type,
            value: discount.value,
            discountAmount: Number(discountAmount.toFixed(2)),
            isFreeShipping,
            newTotal: Number((subtotal - discountAmount).toFixed(2)),
        };
    }

    // ── 3. GESTIÓN DE CONSUMO Y LIBERACIÓN POR ID (ÓRDENES) ─────────────────
    async consumeCouponById(discountId: string, userId: string, session?: ClientSession) {
        const discount = await this.discountRepository.findById(discountId, session);
        if (!discount) return;

        const hasUsedBefore = discount.usedBy.some(
            (u) => u.userId.toString() === userId.toString()
        );

        await this.discountRepository.incrementUsageById(discountId, userId, hasUsedBefore, session);
    }

    async releaseCouponById(discountId: string, userId: string, session?: ClientSession) {
        const discount = await this.discountRepository.findById(discountId, session);
        if (!discount) return;

        await this.discountRepository.decrementUsageById(discountId, userId, session);
    }

    // ── 4. CRUD ADMINISTRATIVO CON VALIDACIONES DE SEGURIDAD ────────────────
    async createDiscount(data: Partial<IDiscount>) {
        if (data.appliesVia === DiscountAppliesVia.AUTOMATIC) {
            if (data.target === DiscountTarget.ALL_PRODUCTS) {
                const minAmount = Number(data.minPurchaseAmount) || 0;
                const hasSpecificGiftProducts =
                    data.bxgyConfig?.getProducts && data.bxgyConfig.getProducts.length > 0;

                if (minAmount <= 0 && !hasSpecificGiftProducts) {
                    throw new AppError(
                        'Por seguridad comercial, una promoción automática para "Todos los productos" debe requerir un Monto Mínimo de Compra mayor a S/ 0 o delimitar los productos de regalo.',
                        400
                    );
                }
            }
        }

        if (data.appliesVia === DiscountAppliesVia.CODE) {
            if (!data.code || !data.code.trim()) {
                throw new AppError('El código del cupón es requerido cuando la aplicación es por código.', 400);
            }
            data.code = data.code.toUpperCase().trim();
            const existing = await this.discountRepository.findByCode(data.code);
            if (existing) {
                throw new AppError('El código del cupón ya existe en el sistema.', 400);
            }
        } else {
            data.code = undefined;
        }

        if (!data.title || !data.title.trim()) {
            throw new AppError('El título promocional es requerido.', 400);
        }

        return await this.discountRepository.create(data);
    }

    async getAllDiscounts(page = 1, limit = 10, search = '') {
        const query: FilterQuery<IDiscount> = {};
        if (search) {
            query.$or = [
                { code: { $regex: search, $options: 'i' } },
                { title: { $regex: search, $options: 'i' } },
            ];
        }

        const { data, total } = await this.discountRepository.findAllPaginated(query, page, limit);
        return { data, total, page, limit };
    }

    async getDiscountById(id: string) {
        const discount = await this.discountRepository.findById(id);
        if (!discount) {
            throw new AppError('Promoción o cupón no encontrado', 404);
        }
        return discount;
    }

    async toggleDiscountStatus(id: string) {
        const discount = await this.discountRepository.findById(id);
        if (!discount) {
            throw new AppError('Cupón no encontrado', 404);
        }

        discount.isActive = !discount.isActive;
        return await this.discountRepository.save(discount);
    }

    async deleteDiscount(id: string) {
        const discount = await this.discountRepository.deleteById(id);
        if (!discount) {
            throw new AppError('Cupón no encontrado', 404);
        }
        return discount;
    }

    // ── 5. MÓDULO DE AUDITORÍA Y REPORTES ───────────────────────────────────
    async getDiscountAnalytics(code: string) {
        const cleanCode = code.trim();

        const stats = await Order.aggregate([
            {
                $match: {
                    discountCode: { $regex: `^${cleanCode}$`, $options: 'i' },
                    status: { $nin: ['canceled'] },
                },
            },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalRevenue: { $sum: '$totalPrice' },
                    totalDiscountGiven: { $sum: '$discountAmount' },
                },
            },
        ]);

        const dbDiscount = await this.discountRepository.findByCode(cleanCode);

        return {
            code: cleanCode,
            title: dbDiscount?.title || cleanCode,
            ordersPlaced: stats[0]?.totalOrders || 0,
            revenueGenerated: stats[0]?.totalRevenue || 0,
            discountsGiven: stats[0]?.totalDiscountGiven || 0,
            currentUsageCount: dbDiscount?.currentUsageCount || 0,
            usageLimitTotal: dbDiscount?.usageLimitTotal || null,
            isActive: dbDiscount?.isActive ?? false,
        };
    }

    async getAutomaticDiscountsForProduct(productId: string) {
        const product = await this.productService.getProductMetadataForDiscount(productId);
        if (!product) return [];

        const autoDiscounts = await this.discountRepository.findActiveAutomaticDiscounts();

        const matchingDiscounts = autoDiscounts.filter((disc) => {
            if (disc.target === 'ALL_PRODUCTS') return true;
            if (disc.target === 'SPECIFIC_PRODUCTS') {
                return disc.applicableProducts.some((p) => p.toString() === productId);
            }
            if (disc.target === 'SPECIFIC_CATEGORIES' && product.categoria) {
                return disc.applicableCategories.some((c) => c.toString() === product.categoria);
            }
            if (disc.target === 'SPECIFIC_BRANDS' && product.brand) {
                return disc.applicableBrands.some((b) => b.toString() === product.brand);
            }
            if (disc.target === 'SPECIFIC_COLLECTIONS' && product.collections.length > 0) {
                return product.collections.some((colId) =>
                    disc.applicableCollections.some((ac) => ac.toString() === colId)
                );
            }
            return false;
        });

        const enrichedDiscounts = await Promise.all(
            matchingDiscounts.map(async (disc) => {
                const discObj = disc.toObject ? disc.toObject() : disc;
                if (discObj.bxgyConfig?.getProducts && discObj.bxgyConfig.getProducts.length > 0) {
                    const giftProducts = await this.productService.getLightProductsByIds(
                        discObj.bxgyConfig.getProducts.map((p: any) => p.toString())
                    );
                    return {
                        ...discObj,
                        giftProductsDetails: giftProducts,
                    };
                }
                return discObj;
            })
        );

        return enrichedDiscounts;
    }
}

export const discountService = new DiscountService(
    new DiscountRepository(),
    productService
);