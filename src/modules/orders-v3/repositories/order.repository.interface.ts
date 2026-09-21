import { IOrder, OrderStatus } from '../../../models/Order';

export interface IOrderFilters {
    status?: OrderStatus;
    email?: string;
    orderNumber?: string;
}

export interface IOrderRepository {
    create(data: Partial<IOrder>): Promise<IOrder>;
    findById(id: string): Promise<IOrder | null>;
    findByOrderNumber(orderNumber: string): Promise<IOrder | null>;
    update(id: string, data: Partial<IOrder>): Promise<IOrder | null>;
    findPaginated(skip: number, limit: number, filters: IOrderFilters): Promise<{ data: IOrder[]; total: number }>;
}