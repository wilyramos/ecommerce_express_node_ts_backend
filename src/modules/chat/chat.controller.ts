import { Request, Response } from 'express';
import { ChatService } from './chat.service';
import { AppError } from '../../utils/AppError';

const chatService = new ChatService();

export class ChatController {
    private handleError(res: Response, error: unknown, defaultMessage: string): void {
        if (error instanceof AppError) {
            res.status(error.statusCode).json({ message: error.message });
            return;
        }
        res.status(500).json({ message: defaultMessage, error: error instanceof Error ? error.message : error });
    }

    sendMessage = async (req: Request, res: Response): Promise<void> => {
        try {
            const { sessionId, message } = req.body;
            const userId = req.user?._id ? (req.user._id as any).toString() : null;
            const response = await chatService.sendMessage(userId, sessionId, message);

            res.status(200).json({ ok: true, data: response });
        } catch (error) {
            this.handleError(res, error, 'Error al procesar la comunicación con la IA.');
        }
    };
}