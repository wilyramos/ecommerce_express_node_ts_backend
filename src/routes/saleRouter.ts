import { Router } from 'express';
import { body, param } from 'express-validator';
import { handleInputErrors } from '../middleware/validation';
import { SaleController } from '../controllers/SaleController';
import { authenticate, isAdminOrVendedor } from '../middleware/auth';


const router = Router();

router.post('/',
    body('items').isArray({ min: 1 }).withMessage('Debe incluir al menos un producto'),
    body('items.*.product').isMongoId().withMessage('ID de producto inválido'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Cantidad debe ser mayor a 0'),
    body('items.*.price').isFloat({ min: 0 }).withMessage('Precio debe ser positivo'),
    body('totalDiscountAmount').optional().isFloat({ min: 0 }),
    body('source').isIn(['ONLINE', 'POS']).withMessage('Fuente inválida'),
    body('status').optional().isIn(['COMPLETADA', 'REEMBOLSADA', 'ANULADA']),
    body('paymentMethod').isIn(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA']).withMessage('Método de pago inválido'),
    body('paymentStatus').optional().isIn(['PAGADO', 'PENDIENTE']),
    body('customer').optional().isMongoId(),
    body('employee').optional().isMongoId(),
    body('order').optional().isMongoId(),
    authenticate,
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
router.get('/:id',
    authenticate,
    isAdminOrVendedor,
    param('id').isMongoId().withMessage('ID de venta inválido'),
    handleInputErrors,
    // SaleController.getSaleById,
);

export default router;