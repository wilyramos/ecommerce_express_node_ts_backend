import { Router } from 'express';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { ProductRepository } from './repositories/product.repository';
import { validateRequest } from '../../middleware/validate.middleware.v3';
import { searchAdminSchema } from './product.schema';
import { authorizeAdmin } from '../../middleware/auth.middleware';

const router = Router();

const productRepository = new ProductRepository();
const productService = new ProductService(productRepository);
const productController = new ProductController(productService);

// Rutas específicas primero
router.get(
    '/admin/search',
    authorizeAdmin,
    validateRequest(searchAdminSchema),
    productController.searchAdmin
);

// Ruta dinámica al final (Pública para que el carrito/favoritos la puedan leer)
router.get('/:id', productController.getById);

export default router;