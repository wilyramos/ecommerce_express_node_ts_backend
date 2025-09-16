import { Router } from 'express';
import { body, param } from 'express-validator';
import { AuthController } from '../controllers/AuthController';
import { handleInputErrors } from '../middleware/validation';
import { authenticate, isAdmin } from '../middleware/auth';
import { BrandController } from '../controllers/BrandController';


const router = Router();

router.post('/',
    authenticate, isAdmin,
    body('nombre').notEmpty().withMessage('Name is required'),
    body('descripcion').notEmpty().withMessage('Description is required'),
    handleInputErrors,
    BrandController.createBrand,
)



export default router;