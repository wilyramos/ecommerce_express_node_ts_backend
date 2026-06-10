import { Router } from 'express';
import { ChatController } from './chat.controller';
import { authenticate } from '../../middleware/auth'; // Si deseas que sea privado

const router = Router();
const chatController = new ChatController();

router.post('/message', chatController.sendMessage);

export default router;