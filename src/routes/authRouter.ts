import { Router } from 'express';
import { body, param } from 'express-validator';
import { AuthController } from '../controllers/AuthController';
import { validationResult } from 'express-validator';
import { handleInputErrors } from '../middleware/validation';



const router = Router();

router.post('/register',
    body('nombre').notEmpty().withMessage('Nombre es requerido'),
    body('email').isEmail().withMessage('Correo electrónico inválido'),
    body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
    handleInputErrors,
    AuthController.register,
)

router.post('/login',
    body('email').isEmail().withMessage('Correo electrónico inválido'),
    body('password').notEmpty().withMessage('Contraseña es requerida'),
    handleInputErrors,
    AuthController.login,
)

export default router;