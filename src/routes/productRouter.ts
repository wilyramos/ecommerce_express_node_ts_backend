import { Router } from 'express';
import { body } from 'express-validator';
import { ProductController } from '../controllers/ProductController';
import { handleInputErrors } from '../middleware/validation';



const router = Router();

router.post('/create',
    body('name').notEmpty().withMessage('Name is required'),
    body('description').notEmpty().withMessage('Description is required'),
    body('price').isNumeric().withMessage('Price must be a number'),
    handleInputErrors,
    ProductController.createProduct,
);



export default router;