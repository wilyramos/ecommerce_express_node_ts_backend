// File: backend/src/modules/user-v3/repositories/user.repository.ts
import User, { IUser } from '../../../models/User';
import { IUserRepository, IUserFilters } from './user.repository.interface';

export class UserRepository implements IUserRepository {
    async create(data: Partial<IUser>): Promise<IUser> {
        return await User.create(data);
    }

    async findById(id: string): Promise<IUser | null> {
        return await User.findOne({ _id: id, deletedAt: null }).select('-password');
    }

    async findByEmail(email: string): Promise<IUser | null> {
        return await User.findOne({ email, deletedAt: null }).select('-password');
    }

    async update(id: string, data: Partial<IUser>): Promise<IUser | null> {
        return await User.findOneAndUpdate(
            { _id: id, deletedAt: null },
            data,
            { new: true, runValidators: true }
        ).select('-password');
    }

    async findPaginated(skip: number, limit: number, filters: IUserFilters): Promise<{ data: IUser[]; total: number }> {
        const query: Record<string, any> = { deletedAt: null };

        if (filters.rol) query.rol = filters.rol;
        if (filters.isActive !== undefined) query.isActive = filters.isActive;

        if (filters.search) {
            query.$or = [
                { email: new RegExp(filters.search, 'i') },
                { nombre: new RegExp(filters.search, 'i') },
                { apellidos: new RegExp(filters.search, 'i') },
                { numeroDocumento: new RegExp(filters.search, 'i') }
            ];
        }

        const [data, total] = await Promise.all([
            User.find(query).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            User.countDocuments(query)
        ]);

        return { data: data as IUser[], total };
    }

    async softDelete(id: string): Promise<IUser | null> {
        return await User.findByIdAndUpdate(
            id,
            { deletedAt: new Date(), isActive: false },
            { new: true }
        ).select('-password');
    }
}