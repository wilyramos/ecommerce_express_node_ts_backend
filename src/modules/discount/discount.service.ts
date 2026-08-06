// File: backend/src/modules/discount/discount.service.ts

import { ClientSession, FilterQuery } from 'mongoose';
import { DiscountType, DiscountAppliesVia, DiscountTarget, IDiscount } from './discount.model';
import Order from '../../models/Order';
import Product from '../../models/Product';
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
        const autoDiscounts = await this.discountRepository.findActiveAutomaticDiscounts();
        if (autoDiscounts.length === 0) {
            return { appliedDiscount: null, discountAmount: 0, newTotal: subtotal, itemDiscounts: [] };
        }

        // Obtener metadatos de los productos en el carrito utilizando las propiedades reales de IProduct
        const dbProducts = await Product.find({
            _id: { $in: cartItems.map((i) => i.productId) }
        }).select('precio precioComparativo').lean();

        let bestDiscountAmount = 0;
        let bestDiscount: IDiscount | null = null;

        for (const discount of autoDiscounts) {
            try {
                // Validación 1: Monto Mínimo de Compra
                if (subtotal < discount.minPurchaseAmount) continue;

                // Validación 2: Límite de Usos Globales
                if (discount.usageLimitTotal && discount.currentUsageCount >= discount.usageLimitTotal) continue;

                // Validación 3: Excluir ítems que ya cuentan con oferta de precio comparativo (precioComparativo > precio)
                const validCartItems = cartItems.filter((item) => {
                    const prod = dbProducts.find((p) => p._id.toString() === item.productId);
                    if (prod && prod.precioComparativo && prod.precio && prod.precioComparativo > prod.precio) {
                        return false;
                    }
                    return true;
                });

                if (validCartItems.length === 0) continue;

                const strategy = getDiscountStrategy(discount.type, discount.target);
                const calculatedAmount = await strategy.calculate(discount, subtotal, validCartItems);

                // Algoritmo "Best-Discount Win": Seleccionar la promoción que proporcione el mayor ahorro
                if (calculatedAmount > bestDiscountAmount) {
                    bestDiscountAmount = calculatedAmount;
                    bestDiscount = discount;
                }
            } catch {
                continue;
            }
        }

        if (!bestDiscount || bestDiscountAmount === 0) {
            return { appliedDiscount: null, discountAmount: 0, newTotal: subtotal, itemDiscounts: [] };
        }

        // Desglose por ítem específico si la promoción es de tipo BUY_X_GET_Y
        const itemDiscounts = cartItems.map((item) => {
            let discountForItem = 0;
            if (bestDiscount?.type === DiscountType.BUY_X_GET_Y && bestDiscount.bxgyConfig) {
                const config = bestDiscount.bxgyConfig;
                const isTargetGift = !config.getProducts || config.getProducts.length === 0
                    ? true
                    : config.getProducts.some((gp) => gp.toString() === item.productId);

                if (isTargetGift) {
                    discountForItem = Math.min(item.price * item.quantity, bestDiscountAmount);
                }
            }
            return {
                productId: item.productId,
                variantId: item.variantId,
                discountAmount: Number(discountForItem.toFixed(2)),
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

        await this.discountRepository.incrementUsageById(
            discountId,
            userId,
            hasUsedBefore,
            session
        );
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


    // En backend/src/modules/discount/discount.service.ts

    async getDiscountById(id: string) {
        const discount = await this.discountRepository.findById(id);
        if (!discount) {
            throw new AppError('Promoción o cupón no encontrado', 404);
        }
        return discount;
    }
}

export const discountService = new DiscountService(
    new DiscountRepository(),
    productService
);


