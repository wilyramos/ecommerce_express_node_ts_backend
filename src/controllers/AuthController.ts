import { Request, Response } from 'express';
import User from "../models/User";
import { generateJWT } from '../utils/jwt';
import { checkPassword, hashPassword } from "../utils/auth";



export class AuthController {

    static async register(req: Request, res: Response) {
        try {
            const { nombre, email, password } = req.body;


            // Verificar si el usuario ya existe
            const userExists = await User.findOne({ email });
            if (userExists) {
                res.status(400).json({ message: 'El usuario ya existe' });
                return;
            }

            // Hashear la contraseña
            const hashedPassword = await hashPassword(password);

            // Crear el nuevo usuario
            const newUser = new User({
                nombre,
                email,
                password: hashedPassword
            });

            await newUser.save();

            // Generar un token JWT
            const token = generateJWT({ id: newUser.id });


            res.status(201).json({
                message: 'Usuario registrado exitosamente',
                userId: newUser.id,
                token: token
            });


        } catch (error) {
            res.status(500).json({ message: 'Error al registrar el usuario', error });
        }
    }

    static async login(req: Request, res: Response) {
        try {
            const { email, contrasena } = req.body;
            // Aquí iría la lógica para autenticar al usuario
            res.status(200).json({ message: 'Usuario autenticado', user: { email } });
        } catch (error) {
            res.status(500).json({ message: 'Error al autenticar el usuario', error });
        }
    }





    static async logout(req: Request, res: Response) {
        try {

            res.status(200).json({ message: 'Usuario desconectado' });
        } catch (error) {
            res.status(500).json({ message: 'Error al cerrar sesión', error });
        }
    }

    static async forgotPassword(req: Request, res: Response) {
        try {
            const { email } = req.body;
            // Aquí iría la lógica para enviar un correo de recuperación de contraseña
            res.status(200).json({ message: 'Correo de recuperación enviado', email });
        } catch (error) {
            res.status(500).json({ message: 'Error al enviar el correo de recuperación', error });
        }
    }

    static async resetPassword(req: Request, res: Response) {
        try {
            const { token, nuevaContrasena } = req.body;
            // Aquí iría la lógica para restablecer la contraseña
            res.status(200).json({ message: 'Contraseña restablecida', token });
        } catch (error) {
            res.status(500).json({ message: 'Error al restablecer la contraseña', error });
        }
    }

    static async refreshToken(req: Request, res: Response) {
        try {
            const { token } = req.body;
            // Aquí iría la lógica para refrescar el token
            res.status(200).json({ message: 'Token refrescado', token });
        } catch (error) {
            res.status(500).json({ message: 'Error al refrescar el token', error });
        }
    }


}