// backend/src/modules/product/product.router.ts
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

router.get(
    '/admin/search',
    authorizeAdmin,
    validateRequest(searchAdminSchema),
    productController.searchAdmin
);


export default router;