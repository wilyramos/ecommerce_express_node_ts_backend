import { Router } from 'express';
import { body } from 'express-validator';
import { CategoryController } from '../controllers/CategoryController';
import { handleInputErrors } from '../middleware/validation';


const router = Router();

router.post('/create',

    body('nombre').notEmpty().withMessage('Name is required'),
    body('descripcion').notEmpty().withMessage('Description is required'),
    handleInputErrors,
    CategoryController.createCategory   
);

router.get('/list', CategoryController.getCategories);

// getCategoryById 
router.get('/:id', CategoryController.getCategoryById);
// getCategoryBySlug
router.get('/slug/:slug', CategoryController.getCategoryBySlug);
// updateCategory
router.put('/update/:id',
    body('nombre').notEmpty().withMessage('Name is required'),
    body('descripcion').notEmpty().withMessage('Description is required'),
    handleInputErrors,
    CategoryController.updateCategory
);

// deleteCategory
router.delete('/delete/:id', CategoryController.deleteCategory);



export default router;