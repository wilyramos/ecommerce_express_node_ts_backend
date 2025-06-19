import { Router } from 'express';
import { body } from 'express-validator';
import { ProductController } from '../controllers/ProductController';
import { handleInputErrors } from '../middleware/validation';
import { authenticate, isAdmin } from '../middleware/auth';


const router = Router();

// Create Product
router.post('/',
    authenticate, isAdmin,
    body('nombre')
        .notEmpty()
        .withMessage('Name is required'),
    body('descripcion')
        .notEmpty()
        .withMessage('La descripción es obligatoria'),

    body('precio')
        .optional()
        .isNumeric()
        .withMessage('El precio debe ser un número')
        .custom((value) => value >= 0)
        .withMessage('El precio debe ser cero o mayor'),

    body('costo')
        .optional()
        .isNumeric()
        .withMessage('El costo debe ser un número')
        .custom((value) => value >= 0)
        .withMessage('El costo debe ser cero o mayor'),

    body('imagenes')
        .optional()
        .isArray({ max: 5 })
        .withMessage('Las imágenes deben ser un arreglo con un máximo de 5 elementos'),

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

    body('atributos')
        .optional()
        .isObject()
        .withMessage('Los atributos deben ser un objeto'),
    handleInputErrors,
    ProductController.createProduct,
);

router.get('/', ProductController.getProducts);

// Get new products
router.get('/new', ProductController.getNewProducts);

// Search products by query
router.get('/search',
    body('query')
        .optional()
        .isString()
        .withMessage('Query must be a string'),
    body('page')
        .optional()
        .isNumeric()
        .withMessage('Page must be a number'),
    body('limit')
        .optional()
        .isNumeric()
        .withMessage('Limit must be a number'),
    handleInputErrors,
    ProductController.searchProducts
);

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

// Get products by SLUG
router.get('/slug/:slug', ProductController.getProductBySlug);

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

// Actualizar el estado de un producto
router.put('/:id/status',
    authenticate, isAdmin,
    body('isActive')
        .isBoolean()
        .withMessage('Status must be a boolean'),
    handleInputErrors,
    ProductController.updateProductStatus
);


// get product related products
router.get('/:slug/related', ProductController.getProductsRelated);




export default router;