import { Router } from 'express';
import { body, param } from 'express-validator';
import { handleInputErrors } from '../middleware/validation';
import { authenticate, isAdmin } from '../middleware/auth';
import { UserController } from '../controllers/UserController';


const router = Router();


// Get all users
router.get("/",
    authenticate,
    isAdmin,
    UserController.getAllUsers
)


export default router;