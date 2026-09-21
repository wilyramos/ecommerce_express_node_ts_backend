// File: backend/src/modules/user-v3/user.service.ts
import { AppError } from '../../utils/AppError';
import { IUserRepository } from './repositories/user.repository.interface';
import { CreateUserInput, UpdateUserInput, UserFiltersQuery } from './user.schema';

export class UserService {
    constructor(private readonly userRepository: IUserRepository) {}

    async createUser(data: CreateUserInput) {
        const existingUser = await this.userRepository.findByEmail(data.email);
        if (existingUser) {
            throw new AppError('El correo electrónico ya está registrado', 400);
        }

        return await this.userRepository.create(data);
    }

    async getUserById(id: string) {
        const user = await this.userRepository.findById(id);
        if (!user) throw new AppError('Usuario no encontrado', 404);
        return user;
    }

    async getProfile(userId: string) {
        const user = await this.userRepository.findById(userId);
        if (!user) throw new AppError('Usuario no encontrado', 404);
        return user;
    }

    async updateProfile(userId: string, data: Partial<UpdateUserInput>) {
        const user = await this.userRepository.findById(userId);
        if (!user) throw new AppError('Usuario no encontrado', 404);

        if (data.email && data.email !== user.email) {
            const emailInUse = await this.userRepository.findByEmail(data.email);
            if (emailInUse) throw new AppError('El correo electrónico ya está en uso por otra cuenta', 400);
        }

        return await this.userRepository.update(userId, data);
    }

    async updateUser(id: string, data: UpdateUserInput) {
        const user = await this.userRepository.findById(id);
        if (!user) throw new AppError('Usuario no encontrado', 404);

        if (data.email && data.email !== user.email) {
            const emailInUse = await this.userRepository.findByEmail(data.email);
            if (emailInUse) throw new AppError('El correo electrónico ya está en uso', 400);
        }

        return await this.userRepository.update(id, data);
    }

    async toggleStatus(id: string) {
        const user = await this.userRepository.findById(id);
        if (!user) throw new AppError('Usuario no encontrado', 404);

        return await this.userRepository.update(id, { isActive: !user.isActive });
    }

    async deleteUser(id: string) {
        const user = await this.userRepository.findById(id);
        if (!user) throw new AppError('Usuario no encontrado', 404);

        await this.userRepository.softDelete(id);
        return { message: 'Usuario eliminado correctamente' };
    }

    async getPaginatedUsers(queryFilters?: UserFiltersQuery) {
        const page = queryFilters?.page || 1;
        const limit = queryFilters?.limit || 10;
        const skip = (page - 1) * limit;

        const filters = {
            search: queryFilters?.search,
            rol: queryFilters?.rol,
            isActive: queryFilters?.isActive === 'true' ? true : queryFilters?.isActive === 'false' ? false : undefined
        };

        const result = await this.userRepository.findPaginated(skip, limit, filters);
        return { ...result, page, limit };
    }
}