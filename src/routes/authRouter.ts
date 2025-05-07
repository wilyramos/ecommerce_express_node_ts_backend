import { Router } from 'express';
import { body, param } from 'express-validator';
import { AuthController } from '../controllers/AuthController';
import { validationResult } from 'express-validator';
import { handleInputErrors } from '../middleware/validation';
import { authenticate } from '../middleware/auth';


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

router.post('/forgot-password',
    body('email').isEmail().withMessage('Correo electrónico inválido'),
    handleInputErrors,
    AuthController.forgotPassword,
)

router.post('/update-password/:token',
    param('token').notEmpty().withMessage('Token es requerido'),
    body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
    handleInputErrors,
    AuthController.updatePasswordWithToken,
)

router.get('/user',
    authenticate,
    AuthController.getUser,
)

router.get('/validate-token/:token',
    param('token').notEmpty().withMessage('Token es requerido'),
    handleInputErrors,
    AuthController.validateToken,
)




export default router;