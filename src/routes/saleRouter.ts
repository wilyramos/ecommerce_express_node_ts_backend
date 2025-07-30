import { Router } from 'express';
import { body, param } from 'express-validator';
import { handleInputErrors } from '../middleware/validation';
import { SaleController } from '../controllers/SaleController';
import { authenticate, isAdminOrVendedor } from '../middleware/auth';


const router = Router();

router.post('/',
    body('items').isArray().withMessage('Los items son obligatorios'),
    body('items.*.productId').isMongoId().withMessage('ID de producto inválido'),
    body('items.*.quantity').isInt({ gt: 0 }).withMessage('La cantidad debe ser mayor a 0'),
    body('totalPrice').isFloat({ gt: 0 }).withMessage('El total debe ser mayor a 0'),
    
    authenticate,
    isAdminOrVendedor,
    handleInputErrors,
    SaleController.createSale,
);

// Endpoint para obtener ventas con filtros opcionales en el query

router.get('/',
    authenticate,
    isAdminOrVendedor,
    SaleController.getSales,
);

// Endpoint para obtener una venta por ID
// router.get('/:id',
//     authenticate,
//     isAdminOrVendedor,
//     param('id').isMongoId().withMessage('ID de venta inválido'),
//     handleInputErrors,
//     // SaleController.getSaleById,
// );

export default router;