import { Router } from 'express';
import { body, param } from 'express-validator';
import { OrderController } from '../controllers/OrderController';
import { handleInputErrors } from '../middleware/validation';
import { authenticate, isAdmin } from '../middleware/auth';


const router = Router();

// Create Order
router.post('/',
    authenticate,
    OrderController.createOrder
);

// Get Order by ID
router.get('/:id',
    authenticate,
    param('id').notEmpty().withMessage('El ID de la orden es obligatorio'),
    handleInputErrors,
    OrderController.getOrderById
);

// Get Orders by User
router.get('/user/me',
    authenticate,
    OrderController.getOrdersByUser
);

// Get Orders from admin
router.get('/',
    authenticate,
    isAdmin,
    OrderController.getOrders
);




// Update Order Status
router.put('/:id',
    authenticate,
    isAdmin,
    body('status').notEmpty().withMessage('El estado es obligatorio'),
    handleInputErrors,
    // AuthController.updateOrderStatus
);

// Delete Order
router.delete('/:id',
    authenticate,
    isAdmin,
    param('id').notEmpty().withMessage('El ID de la orden es obligatorio'),
    handleInputErrors,
    // AuthController.deleteOrder
);

// Get Orders by Status
router.get('/status/:status',
    authenticate,
    isAdmin,
    param('status').notEmpty().withMessage('El estado es obligatorio'),
    handleInputErrors,
    // AuthController.getOrdersByStatus
);

// Get Orders by Date Range
router.get('/date-range',
    authenticate,
    isAdmin,
    body('startDate').notEmpty().withMessage('La fecha de inicio es obligatoria'),
    body('endDate').notEmpty().withMessage('La fecha de fin es obligatoria'),
    handleInputErrors,
    // AuthController.getOrdersByDateRange
);

// Get Orders by Payment Status
router.get('/payment-status/:status',
    authenticate,
    isAdmin,
    param('status').notEmpty().withMessage('El estado de pago es obligatorio'),
    handleInputErrors,
    // AuthController.getOrdersByPaymentStatus
);


// REPORTS

router.get('/reports/sales-summary',
    authenticate,
    isAdmin,
    OrderController.getSummaryOrders
);

// get orders over time
router.get('/reports/sales-over-time',
    authenticate,
    isAdmin,
    OrderController.getOrdersOverTime
);

// obtener el numero de ordenes por estado
router.get('/reports/orders-by-status',
    // authenticate,
    // isAdmin,
    OrderController.getReportOrdersByStatus
);

export default router;