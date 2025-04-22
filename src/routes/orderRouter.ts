import { Router } from 'express';
import { body, param } from 'express-validator';
import { AuthController } from '../controllers/AuthController';
import { validationResult } from 'express-validator';
import { handleInputErrors } from '../middleware/validation';
import { authenticate, isAdmin } from '../middleware/auth';


const router = Router();

// Create Order
router.post('/create',
    authenticate,
    

);
// Get Orders by User ID
router.get('/',
    authenticate,
    // AuthController.getOrdersByUserId
);

// Get Order by ID
router.get('/:id',
    authenticate,
   
    
)

/** ADMINISTRADORES */

// Actualizar el estado de la orden
router.put('/:id/status',
    authenticate,
    isAdmin,
    
)

router.get('/all',
    authenticate,
    isAdmin,
    // AuthController.getAllOrders
)





export default router;