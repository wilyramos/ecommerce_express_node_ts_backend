import { Router } from 'express';
import { authenticate, isAdminOrVendedor } from '../middleware/auth';
import { UserController } from '../controllers/UserController';


const router = Router();


// Get all users
router.get("/",
    authenticate,
    isAdminOrVendedor,
    UserController.getAllUsers
)


export default router;