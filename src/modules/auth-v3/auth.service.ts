// File: backend/src/modules/auth-v3/auth.service.ts
import { AppError } from '../../utils/AppError';
import { IAuthRepository } from './repositories/auth.repository.interface';
import { LoginInput, UpdatePasswordInput } from './auth.schema';
import { checkPassword, hashPassword } from '../../utils/auth';
import { generateJWT } from '../../utils/jwt';

export class AuthService {
    constructor(private readonly authRepository: IAuthRepository) {}

    async login(data: LoginInput) {
        // 1. Buscar usuario por email
        const user = await this.authRepository.findByEmailWithPassword(data.email);
        if (!user) {
            throw new AppError('Credenciales incorrectas', 401);
        }

        // 2. Verificar contraseña usando tu utilidad
        const isMatch = await checkPassword(data.password, user.password);
        if (!isMatch) {
            throw new AppError('Credenciales incorrectas', 401);
        }

        if (!user.isActive) {
            throw new AppError('Tu cuenta está desactivada', 403);
        }

        // 3. Generar token usando tu utilidad
        const token = generateJWT({ id: user._id as any });

        // Remover el password antes de devolver el usuario
        const { password, ...userWithoutPassword } = user;

        return {
            user: userWithoutPassword,
            token
        };
    }

    async updatePassword(userId: string, data: UpdatePasswordInput): Promise<void> {
        const user = await this.authRepository.findByIdWithPassword(userId);
        if (!user) {
            throw new AppError('Usuario no encontrado', 404);
        }

        // 1. Verificar contraseña actual usando tu utilidad
        const isMatch = await checkPassword(data.currentPassword, user.password);
        if (!isMatch) {
            throw new AppError('La contraseña actual es incorrecta', 400);
        }

        // 2. Hashear nueva contraseña usando tu utilidad
        const hashedPassword = await hashPassword(data.newPassword);

        // 3. Actualizar en BD
        await this.authRepository.updatePassword(userId, hashedPassword);
    }
}