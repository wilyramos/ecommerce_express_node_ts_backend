import { Router } from 'express';
import { body } from 'express-validator';
import { ProductController } from '../controllers/ProductController';
import { handleInputErrors } from '../middleware/validation';


const router = Router();

router.post('/create',
    body('nombre')
        .notEmpty()
        .withMessage('Name is required'),
    body('descripcion')
        .optional()
        .isString()
        .withMessage('Description must be a string'),
    body('precio')
        .isNumeric()
        .withMessage('Price must be a number')
        .custom(value => value > 0)
        .withMessage('Price must be greater than zero'),
    body('categoria')
        .notEmpty()
        .withMessage('Category is required'),
    body('stock')
        .notEmpty()
        .isNumeric()
        .withMessage('Stock is required and must be a number')
        .custom(value => value >= 0)
        .withMessage('Stock must be zero or greater'),
    body('sku')
        .optional()
        .isString()
        .withMessage('SKU must be a string'),
    handleInputErrors,
    ProductController.createProduct,
);

router.get('/list', ProductController.getProducts);
router.get('/:id', ProductController.getProductById);
router.put('/update/:id',
    
    ProductController.updateProduct
);

router.delete('/delete/:id', ProductController.deleteProduct);
//getProductsByCategory
router.get('/category/:categoryId', ProductController.getProductsByCategory);


// router.post('/upload-image', ProductController.uploadImage);

export default router;