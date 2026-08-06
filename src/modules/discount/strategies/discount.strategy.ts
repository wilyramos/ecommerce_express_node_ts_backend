// File: backend/src/modules/discount/strategies/discount.strategy.ts

import { IDiscount, DiscountTarget, DiscountType } from '../discount.model';
import { ICartItemValidation } from '../discount.service';
import Product from '../../../models/Product';
import { AppError } from '../../../utils/AppError';

export interface IDiscountStrategy {
    calculate(
        discount: IDiscount,
        subtotal: number,
        cartItems: ICartItemValidation[]
    ): Promise<number>;
}

// Estrategia: Aplica a TODOS los productos
export class AllProductsStrategy implements IDiscountStrategy {
    async calculate(discount: IDiscount, subtotal: number): Promise<number> {
        if (discount.type === DiscountType.PERCENTAGE) {
            return subtotal * (discount.value / 100);
        }
        if (discount.type === DiscountType.FIXED_AMOUNT) {
            return Math.min(discount.value, subtotal);
        }
        return 0;
    }
}

// Estrategia: Aplica a PRODUCTOS ESPECÍFICOS
export class SpecificProductsStrategy implements IDiscountStrategy {
    async calculate(
        discount: IDiscount,
        _subtotal: number,
        cartItems: ICartItemValidation[]
    ): Promise<number> {
        const applicableItemTotal = cartItems.reduce((acc, item) => {
            const pId = item.productId.toString();
            const isApplicable = discount.applicableProducts.some(
                (ap) => ap.toString() === pId
            );
            return isApplicable ? acc + item.price * item.quantity : acc;
        }, 0);

        if (applicableItemTotal === 0) {
            throw new AppError(
                'El cupón no aplica a ninguno de los productos en tu carrito.',
                400
            );
        }

        if (discount.type === DiscountType.PERCENTAGE) {
            return applicableItemTotal * (discount.value / 100);
        }
        if (discount.type === DiscountType.FIXED_AMOUNT) {
            return Math.min(discount.value, applicableItemTotal);
        }
        return 0;
    }
}

// Estrategia: Aplica a CATEGORÍAS, MARCAS, COLECCIONES O LÍNEAS
export class SpecificMetadataStrategy implements IDiscountStrategy {
    async calculate(
        discount: IDiscount,
        _subtotal: number,
        cartItems: ICartItemValidation[]
    ): Promise<number> {
        const productIds = cartItems.map((item) => item.productId);
        const dbProducts = await Product.find({ _id: { $in: productIds } }).select(
            'categoria brand collections line'
        );

        const applicableItemTotal = cartItems.reduce((acc, item) => {
            const prod = dbProducts.find(
                (p) => p._id.toString() === item.productId.toString()
            );
            let isApplicable = false;

            if (prod) {
                if (
                    discount.target === DiscountTarget.SPECIFIC_CATEGORIES &&
                    prod.categoria
                ) {
                    isApplicable = discount.applicableCategories.some(
                        (ac) => ac.toString() === prod.categoria.toString()
                    );
                } else if (
                    discount.target === DiscountTarget.SPECIFIC_BRANDS &&
                    prod.brand
                ) {
                    isApplicable = discount.applicableBrands.some(
                        (ab) => ab.toString() === prod.brand.toString()
                    );
                } else if (
                    discount.target === DiscountTarget.SPECIFIC_COLLECTIONS &&
                    prod.collections
                ) {
                    isApplicable = prod.collections.some((c) =>
                        discount.applicableCollections.some(
                            (ac) => ac.toString() === c.toString()
                        )
                    );
                } else if (
                    discount.target === DiscountTarget.SPECIFIC_LINES &&
                    prod.line
                ) {
                    isApplicable = discount.applicableLines.some(
                        (al) => al.toString() === prod.line.toString()
                    );
                }
            }

            return isApplicable ? acc + item.price * item.quantity : acc;
        }, 0);

        if (applicableItemTotal === 0) {
            throw new AppError(
                'El cupón no aplica a los productos en tu carrito.',
                400
            );
        }

        if (discount.type === DiscountType.PERCENTAGE) {
            return applicableItemTotal * (discount.value / 100);
        }
        if (discount.type === DiscountType.FIXED_AMOUNT) {
            return Math.min(discount.value, applicableItemTotal);
        }
        return 0;
    }
}

// Estrategia Corregida: Regla Buy X Get Y (Compra X y Lleva Y)
export class BuyXGetYStrategy implements IDiscountStrategy {
    async calculate(
        discount: IDiscount,
        _subtotal: number,
        cartItems: ICartItemValidation[]
    ): Promise<number> {
        const config = discount.bxgyConfig;
        if (!config) {
            throw new AppError('Configuración Buy X Get Y no encontrada en la promoción.', 400);
        }

        const { buyQuantity, getQuantity, getDiscountType, getDiscountValue, getProducts } = config;

        const productIds = cartItems.map((item) => item.productId.toString());
        const dbProducts = await Product.find({ _id: { $in: productIds } }).select(
            'categoria brand collections line'
        );

        // 1. Filtrar artículos del carrito que cumplen la condición de compra X
        const qualifyingItems = cartItems.filter((item) => {
            const pId = item.productId.toString();
            const prod = dbProducts.find((p) => p._id.toString() === pId);

            if (discount.target === DiscountTarget.ALL_PRODUCTS) return true;

            if (discount.target === DiscountTarget.SPECIFIC_PRODUCTS) {
                return discount.applicableProducts.some((ap) => ap.toString() === pId);
            }

            if (prod) {
                if (discount.target === DiscountTarget.SPECIFIC_CATEGORIES && prod.categoria) {
                    return discount.applicableCategories.some((ac) => ac.toString() === prod.categoria.toString());
                }
                if (discount.target === DiscountTarget.SPECIFIC_BRANDS && prod.brand) {
                    return discount.applicableBrands.some((ab) => ab.toString() === prod.brand.toString());
                }
                if (discount.target === DiscountTarget.SPECIFIC_COLLECTIONS && prod.collections) {
                    return prod.collections.some((c) =>
                        discount.applicableCollections.some((ac) => ac.toString() === c.toString())
                    );
                }
                if (discount.target === DiscountTarget.SPECIFIC_LINES && prod.line) {
                    return discount.applicableLines.some((al) => al.toString() === prod.line.toString());
                }
            }

            return false;
        });

        const isSameProductReward = !getProducts || getProducts.length === 0;

        // 2. Validar que existan unidades suficientes según si el regalo es del mismo grupo o de productos específicos
        if (isSameProductReward) {
            // Para promociones como 3x2 en los mismos productos, se requieren mínimo (X + Y) unidades en el carrito
            const totalUnitsInCart = qualifyingItems.reduce((acc, item) => acc + item.quantity, 0);
            const requiredUnitsPerSet = buyQuantity + getQuantity;

            if (totalUnitsInCart < requiredUnitsPerSet) {
                throw new AppError(
                    `Para esta oferta debes agregar al menos ${requiredUnitsPerSet} producto(s) elegible(s) a tu carrito.`,
                    400
                );
            }

            const setsCount = Math.floor(totalUnitsInCart / requiredUnitsPerSet);
            const maxRewardedUnitsAllowed = setsCount * getQuantity;

            if (maxRewardedUnitsAllowed === 0) return 0;

            // Ordenar precios de menor a mayor para bonificar siempre el de menor valor
            const unitPrices: number[] = [];
            qualifyingItems.forEach((item) => {
                for (let i = 0; i < item.quantity; i++) {
                    unitPrices.push(item.price);
                }
            });
            unitPrices.sort((a, b) => a - b);

            const rewardedPrices = unitPrices.slice(0, maxRewardedUnitsAllowed);

            let totalDiscount = 0;
            rewardedPrices.forEach((price) => {
                if (getDiscountType === 'FREE' || (getDiscountType === 'PERCENTAGE' && getDiscountValue === 100)) {
                    totalDiscount += price;
                } else if (getDiscountType === 'PERCENTAGE') {
                    totalDiscount += price * (getDiscountValue / 100);
                } else if (getDiscountType === 'FIXED_AMOUNT') {
                    totalDiscount += Math.min(price, getDiscountValue);
                }
            });

            return Number(totalDiscount.toFixed(2));
        } else {
            // Regla donde los regalos son productos específicos (ej. Compra X y lleva Regalo Y)
            const totalBuyUnits = qualifyingItems.reduce((acc, item) => acc + item.quantity, 0);

            if (totalBuyUnits < buyQuantity) {
                throw new AppError(
                    `Para este descuento debes agregar al menos ${buyQuantity} producto(s) elegible(s) de compra.`,
                    400
                );
            }

            const setsCount = Math.floor(totalBuyUnits / buyQuantity);
            const maxRewardedUnitsAllowed = setsCount * getQuantity;

            const giftItems = cartItems.filter((item) =>
                getProducts.some((gp) => gp.toString() === item.productId.toString())
            );

            const giftUnitPrices: number[] = [];
            giftItems.forEach((item) => {
                for (let i = 0; i < item.quantity; i++) {
                    giftUnitPrices.push(item.price);
                }
            });

            if (giftUnitPrices.length === 0) return 0;

            giftUnitPrices.sort((a, b) => a - b);
            const rewardedPrices = giftUnitPrices.slice(0, maxRewardedUnitsAllowed);

            let totalDiscount = 0;
            rewardedPrices.forEach((price) => {
                if (getDiscountType === 'FREE' || (getDiscountType === 'PERCENTAGE' && getDiscountValue === 100)) {
                    totalDiscount += price;
                } else if (getDiscountType === 'PERCENTAGE') {
                    totalDiscount += price * (getDiscountValue / 100);
                } else if (getDiscountType === 'FIXED_AMOUNT') {
                    totalDiscount += Math.min(price, getDiscountValue);
                }
            });

            return Number(totalDiscount.toFixed(2));
        }
    }
}