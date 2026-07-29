// File: backend/src/modules/discount/discount.service.ts
import Discount, { DiscountType, DiscountTarget, IDiscount } from './discount.model';
import { AppError } from '../../utils/AppError';
import { FilterQuery } from 'mongoose';

export const discountService = {
    /**
     * Valida un cupón frente al carrito actual del usuario
     */
    async validateAndCalculateDiscount(code: string, subtotal: number, cartItems: any[], userId?: string) {
        if (!code) throw new AppError('Debe ingresar un código de cupón.', 400);

        const discount = await Discount.findOne({ code: code.trim().toUpperCase(), isActive: true });

        if (!discount) throw new AppError('El cupón ingresado no existe o no es válido.', 404);

        // 1. Validar Vigencia
        const now = new Date();
        if (now < discount.startDate) throw new AppError('Este cupón aún no está activo.', 400);
        if (discount.endDate && now > discount.endDate) throw new AppError('Este cupón ha expirado.', 400);

        // 2. Validar Monto Mínimo
        if (subtotal < discount.minPurchaseAmount) {
            throw new AppError(`Este cupón requiere una compra mínima de S/ ${discount.minPurchaseAmount.toFixed(2)}.`, 400);
        }

        // 3. Validar Uso Total Global
        if (discount.usageLimitTotal && discount.currentUsageCount >= discount.usageLimitTotal) {
            throw new AppError('Este cupón ha alcanzado su límite máximo de usos a nivel global.', 400);
        }

        // 4. Validar Uso por Cliente (Si hay identificador)
        if (userId) {
            const userUsage = discount.usedBy.find(u => u.userId.toString() === userId.toString());
            if (userUsage && userUsage.count >= discount.usageLimitPerCustomer) {
                throw new AppError('Ya has utilizado este cupón el máximo de veces permitido.', 400);
            }
        }

        // 5. Calcular Descuento
        let discountAmount = 0;

        if (discount.target === DiscountTarget.ALL_PRODUCTS) {
            // Aplica a todo el carrito
            if (discount.type === DiscountType.PERCENTAGE) {
                discountAmount = subtotal * (discount.value / 100);
            } else if (discount.type === DiscountType.FIXED_AMOUNT) {
                discountAmount = discount.value;
            }
        } else if (discount.target === DiscountTarget.SPECIFIC_PRODUCTS) {
            // Aplica solo a productos específicos en el carrito
            const applicableItemTotal = cartItems.reduce((acc, item) => {
                // Asume que item tiene productId como String o ObjectId
                const pId = item.productId.toString();
                const isApplicable = discount.applicableProducts.some(ap => ap.toString() === pId);
                
                if (isApplicable) {
                    return acc + (item.price * item.quantity);
                }
                return acc;
            }, 0);

            if (applicableItemTotal === 0) {
                 throw new AppError('El cupón no aplica a ninguno de los productos de tu carrito.', 400);
            }

            if (discount.type === DiscountType.PERCENTAGE) {
                discountAmount = applicableItemTotal * (discount.value / 100);
            } else if (discount.type === DiscountType.FIXED_AMOUNT) {
                discountAmount = Math.min(discount.value, applicableItemTotal); // No descontar más del valor de los items aplicables
            }
        }

        // Asegurarse de que el descuento no sea mayor al subtotal global
        discountAmount = Math.min(discountAmount, subtotal);

        return {
            code: discount.code,
            type: discount.type,
            value: discount.value,
            discountAmount: Number(discountAmount.toFixed(2)),
            newTotal: Number((subtotal - discountAmount).toFixed(2))
        };
    },

    // CRUD Básico Administrativo
    async createDiscount(data: Partial<IDiscount>) {
        data.code = data.code?.toUpperCase().trim();
        const existing = await Discount.findOne({ code: data.code });
        if (existing) throw new AppError('El código del cupón ya existe.', 400);
        return await Discount.create(data);
    },

    async getAllDiscounts(page = 1, limit = 10, search = '') {
        const query: FilterQuery<IDiscount> = {};
        if (search) {
            query.code = { $regex: search, $options: 'i' };
        }

        const total = await Discount.countDocuments(query);
        const data = await Discount.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        return { data, total, page, limit };
    },

    async toggleDiscountStatus(id: string) {
        const discount = await Discount.findById(id);
        if (!discount) throw new AppError('Cupón no encontrado', 404);
        discount.isActive = !discount.isActive;
        return await discount.save();
    },
    
    async deleteDiscount(id: string) {
        const discount = await Discount.findByIdAndDelete(id);
        if (!discount) throw new AppError('Cupón no encontrado', 404);
        return discount;
    }
};