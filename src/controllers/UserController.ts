import { Request, Response } from 'express';
import User from '../models/User';


export class UserController {

   static async getAllUsers(req: Request, res: Response) {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 25;
        const nombre = req.query.nombre as string;
        const email = req.query.email as string;
        const telefono = req.query.telefono as string;
        const numeroDocumento = req.query.numeroDocumento as string;

        if (limit > 100) {
            res.status(400).json({ message: 'El límite máximo es 100' });
            return;
        }

        const skip = (page - 1) * limit;

        const searchConditions: any = {
            rol: { $in: ['administrador', 'vendedor'] }
        };

        if (nombre) {
            searchConditions.nombre = { $regex: new RegExp(nombre, 'i') };
        }

        if (email) {
            searchConditions.email = { $regex: new RegExp(email, 'i') };
        }

        if (telefono) {
            searchConditions.telefono = { $regex: new RegExp(telefono, 'i') };
        }

        if (numeroDocumento) {
            searchConditions.numeroDocumento = { $regex: new RegExp(numeroDocumento, 'i') };
        }

        const [totalUsers, users] = await Promise.all([
            User.countDocuments(searchConditions),
            User.find(searchConditions)
                .skip(skip)
                .limit(limit)
                .select('-password')
                .lean()
                .sort({ createdAt: -1 })
        ]);

        res.status(200).json({
            totalUsers,
            currentPage: page,
            totalPages: Math.ceil(totalUsers / limit),
            users
        });
    } catch {
        res.status(500).json({ message: 'Error al obtener los usuarios' });
    }
}

static async getAllClients(req: Request, res: Response) {
    try {
        // Paginado simple

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 25;
        const skip = (page - 1) * limit;

        const clients = await User.find({ rol: 'cliente' })
            .skip(skip)
            .limit(limit)
            .select('-password')
            .lean()
            .sort({ createdAt: -1 });

        const totalClients = await User.countDocuments({ rol: 'cliente' });
        res.status(200).json({
            totalUsers: totalClients,
            currentPage: page,
            totalPages: Math.ceil(totalClients / limit),
            users: clients
        });
    } catch {
        res.status(500).json({ message: 'Error al obtener los clientes' });
    }
}

    static async getUserById(req: Request, res: Response) {
        try {
            const userId = req.params.id;
            // Aquí iría la lógica para obtener un usuario por ID
            res.status(200).json({ message: `Usuario con ID ${userId}` });
        } catch (error) {
            res.status(500).json({ message: 'Error al obtener el usuario', error });
        }
    }

    static async createUser(req: Request, res: Response) {
        try {
            const newUser = req.body;
            // Aquí iría la lógica para crear un nuevo usuario
            res.status(201).json({ message: 'Usuario creado', user: newUser });
        } catch (error) {
            res.status(500).json({ message: 'Error al crear el usuario', error });
        }
    }

    static async updateUser(req: Request, res: Response) {
        console.log('updateUser', req.body);
    }

    static async deleteUser(req: Request, res: Response) {
        console.log('deleteUser', req.params.id);
    }

    static async getUserProfile(req: Request, res: Response) {
        try {
            const userId = req.user.id; // Asumiendo que el ID del usuario está en el token
            // Aquí iría la lógica para obtener el perfil del usuario
            res.status(200).json({ message: `Perfil del usuario con ID ${userId}` });
        } catch (error) {
            res.status(500).json({ message: 'Error al obtener el perfil del usuario', error });
        }
    }
}