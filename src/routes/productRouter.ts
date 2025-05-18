import { Router } from 'express';
import { body } from 'express-validator';
import { ProductController } from '../controllers/ProductController';
import { handleInputErrors } from '../middleware/validation';
import { authenticate, isAdmin } from '../middleware/auth';


const router = Router();

router.post('/',
    authenticate, isAdmin,
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
        .custom(value => value > -1)
        .withMessage('Price must be zero or greater'),
    body('categoria')
        .notEmpty()
        .withMessage('Category is required'),
    body('stock')
        .notEmpty()
        .isNumeric()
        .withMessage('Stock is required and must be a number')
        .custom(value => value > -1)
        .withMessage('Stock must be zero or greater'),
    body('sku')
        .optional()
        .isString()
        .withMessage('SKU must be a string'),
    handleInputErrors,
    ProductController.createProduct,
);

router.get('/', ProductController.getProducts);

router.get('/filter',
    
    body('page')
        .optional()
        .isNumeric()
        .withMessage('Page must be a number'),
    body('limit')
        .optional()
        .isNumeric()
        .withMessage('Limit must be a number'),
    body('category')
        .optional()
        .isString()
        .withMessage('Category must be a string'),
    body('priceRange')
        .optional()
        .isString()
        .withMessage('Price range must be a string'),
    handleInputErrors,
    ProductController.getProductsByFilter
);

router.get('/:id', ProductController.getProductById);

router.put('/:id',
    
    authenticate, isAdmin,
    ProductController.updateProduct
);

router.delete('/:id', authenticate, isAdmin, ProductController.deleteProduct);

//getProductsByCategory
router.get('/category/:categoryId',
    ProductController.getProductsByCategory);

// router.get('/category/:categoryId', ProductController.getProductsByCategory);

// uploadImage Product
router.post('/:id/upload-images',
    authenticate, isAdmin,
    ProductController.uploadImagesToProduct
);

// uploadImage Cloudinary
router.post('/upload-images',
    authenticate, isAdmin,
    ProductController.uploadImageCloudinary
);
    


export default router;