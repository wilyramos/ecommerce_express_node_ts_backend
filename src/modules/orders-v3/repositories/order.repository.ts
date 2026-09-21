import Order, { IOrder } from '../../../models/Order';
import { IOrderRepository, IOrderFilters } from './order.repository.interface';

export class OrderRepository implements IOrderRepository {
    async create(data: Partial<IOrder>): Promise<IOrder> {
        return await Order.create(data);
    }

    async findById(id: string): Promise<IOrder | null> {
        return await Order.findById(id).populate('user', 'nombre apellidos email');
    }

    async findByOrderNumber(orderNumber: string): Promise<IOrder | null> {
        return await Order.findOne({ orderNumber }).lean();
    }

    async update(id: string, data: Partial<IOrder>): Promise<IOrder | null> {
        return await Order.findByIdAndUpdate(id, data, { new: true });
    }

    async findPaginated(skip: number, limit: number, filters: IOrderFilters): Promise<{ data: IOrder[]; total: number }> {
        const query: Record<string, unknown> = {};

        if (filters.status) query.status = filters.status;
        if (filters.email) query['customerProfile.email'] = new RegExp(filters.email, 'i');
        if (filters.orderNumber) query.orderNumber = new RegExp(filters.orderNumber, 'i');

        const [data, total] = await Promise.all([
            Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            Order.countDocuments(query)
        ]);

        return { data: data as IOrder[], total };
    }
}