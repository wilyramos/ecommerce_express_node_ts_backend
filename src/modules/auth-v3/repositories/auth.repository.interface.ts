// File: backend/src/modules/auth-v3/repositories/auth.repository.interface.ts
import { IUser } from '../../../models/User';

export interface IAuthRepository {
    findByEmailWithPassword(email: string): Promise<IUser | null>;
    findByIdWithPassword(id: string): Promise<IUser | null>;
    updatePassword(id: string, newPasswordHash: string): Promise<void>;
}