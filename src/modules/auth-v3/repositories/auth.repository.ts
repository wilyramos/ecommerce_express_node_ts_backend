// File: backend/src/modules/auth-v3/repositories/auth.repository.ts
import User, { IUser } from '../../../models/User';
import { IAuthRepository } from './auth.repository.interface';

export class AuthRepository implements IAuthRepository {
    async findByEmailWithPassword(email: string): Promise<IUser | null> {
        return await User.findOne({ email }).select('+password').lean();
    }

    async findByIdWithPassword(id: string): Promise<IUser | null> {
        return await User.findById(id).select('+password').lean();
    }

    async updatePassword(id: string, newPasswordHash: string): Promise<void> {
        await User.findByIdAndUpdate(id, { password: newPasswordHash });
    }
}