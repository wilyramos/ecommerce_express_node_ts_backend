import { Request, Response } from 'express';
import User from "../models/User";
import { generateJWT } from '../utils/jwt';
import { checkPassword, hashPassword } from "../utils/auth";
import Token from '../models/Token';
import { generateToken } from '../utils/token';
import { AuthEmail } from '../emails/AuthEmail';

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
            res.status(500).json({ message: 'Error al registrar el usuario'});
            return;
        }
    }

    static async login(req: Request, res: Response) {
        try {
            const { email, password } = req.body;

            // Verificar si el usuario existe
            const user = await User.findOne({ email }).select('+password');
            if (!user) {
                res.status(400).json({ message: 'Credenciales invalidas' });
                return;
            }

            console.log(user.rol)

            // Verificar la contraseña
            const isPasswordValid = await checkPassword(password, user.password);
            
            if (!isPasswordValid) {
                res.status(400).json({ message: 'Credenciales invalidas' });
                return;
            }

            // Generar un token JWT
            const token = generateJWT({ id: user.id });

            res.status(200).json({
                message: 'Inicio de sesión exitsdasdoso',
                userId: user.id,
                token: token,
                role: user.rol,
            });
        } catch (error) {
            // console.error('Error en el inicio de sesión:', error);
            res.status(500).json({ message: 'Error al iniciar sesión' });
            return;
        }
    }

    static async forgotPassword(req: Request, res: Response) {
        try {
            const { email } = req.body;

            // Verificar si el usuario existe
            const user = await User.findOne({ email });
            if (!user) {
                res.status(400).json({ message: 'El usuario no existe' });
                return;
            }

            const token = new Token();
            token.token = generateToken();
            token.user = user.id;
            await token.save();

            AuthEmail.sendEmailResetPassword({
                email: user.email,
                name: user.nombre,
                token: token.token
            }).then(() => {
                console.log('Email sent successfully');
            }
            ).catch((error) => {
                console.error('Error sending email:', error);
            });

            // Generar un token de restablecimiento de contraseña


            res.status(200).json({ message: 'Email de restablecimiento de contraseña enviado' });
    
        } catch (error) {
            res.status(500).json({ message: 'Error al restablecer la contraseña' });
            return; 
        }
        
    }

    static async updatePasswordWithToken(req: Request, res: Response) {
        try {
            const { token } = req.params;
            const { password } = req.body;

            const tokenExists = await Token.findOne({ token });
            if (!tokenExists) {
                res.status(400).json({ message: 'Token inválido' });
                return;
            }

            const user = await User.findById(tokenExists.user);
            if (!user) {
                res.status(400).json({ message: 'Usuario no encontrado' });
                return;
            }

            // Hashear la nueva contraseña
            const hashedPassword = await hashPassword(password);
            user.password = hashedPassword;
            // await user.save();
            // await tokenExists.deleteOne();

            await Promise.all([user.save(), tokenExists.deleteOne()]);

            res.status(200).json({ message: 'Contraseña actualizada exitosamente' });
            
        } catch (error) {
            res.status(500).json({ message: 'Error al restablecer la contraseña' });
            return;            
        }
    }

    static async getUser(req: Request, res: Response) {
        res.json(req.user);
    }

    static async validateToken(req: Request, res: Response) {
        try {
            const { token } = req.params;

            // Verificar si el token existe
            const tokenExists = await Token.findOne({ token });
            if (!tokenExists) {
                res.status(400).json({ message: 'Token inválido' });
                return;
            }

            res.json({ message: 'Token válido' });

        } catch (error) {
            res.status(500).json({ message: 'Error al validar el token' });
            return;
        }
    }
}