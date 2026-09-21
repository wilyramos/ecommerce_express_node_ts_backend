// File: backend/src/modules/user-v3/repositories/user.repository.interface.ts
import { IUser, UserRole } from '../../../models/User';

export interface IUserFilters {
    search?: string;
    rol?: UserRole;
    isActive?: boolean;
}

export interface IUserRepository {
    create(data: Partial<IUser>): Promise<IUser>;
    findById(id: string): Promise<IUser | null>;
    findByEmail(email: string): Promise<IUser | null>;
    update(id: string, data: Partial<IUser>): Promise<IUser | null>;
    findPaginated(skip: number, limit: number, filters: IUserFilters): Promise<{ data: IUser[]; total: number }>;
    softDelete(id: string): Promise<IUser | null>;
}