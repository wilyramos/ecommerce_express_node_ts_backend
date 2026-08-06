// File: backend/src/modules/discount/strategies/discount-strategy.factory.ts

import { DiscountTarget, DiscountType } from '../discount.model';
import {
    IDiscountStrategy,
    AllProductsStrategy,
    SpecificProductsStrategy,
    SpecificMetadataStrategy,
    BuyXGetYStrategy,
} from './discount.strategy';
import { AppError } from '../../../utils/AppError';

export const getDiscountStrategy = (discountType: DiscountType, target: DiscountTarget): IDiscountStrategy => {
    if (discountType === DiscountType.BUY_X_GET_Y) {
        return new BuyXGetYStrategy();
    }

    const strategyMap: Record<string, IDiscountStrategy> = {
        [DiscountTarget.ALL_PRODUCTS]: new AllProductsStrategy(),
        [DiscountTarget.SPECIFIC_PRODUCTS]: new SpecificProductsStrategy(),
        [DiscountTarget.SPECIFIC_CATEGORIES]: new SpecificMetadataStrategy(),
        [DiscountTarget.SPECIFIC_BRANDS]: new SpecificMetadataStrategy(),
        [DiscountTarget.SPECIFIC_COLLECTIONS]: new SpecificMetadataStrategy(),
        [DiscountTarget.SPECIFIC_LINES]: new SpecificMetadataStrategy(),
    };

    const strategy = strategyMap[target];
    if (!strategy) {
        throw new AppError('Tipo de objetivo de descuento no soportado.', 400);
    }
    return strategy;
};