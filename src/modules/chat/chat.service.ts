import { Chat, IChat } from './chat.model';
import { ProductService } from '../product/product.service';
import { AppError } from '../../utils/AppError';
import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const productService = new ProductService();

export class ChatService {
    
    /**
     * Procesa el mensaje del usuario, busca contexto en el catálogo 
     * y genera una respuesta con IA manteniendo el historial.
     */
    async sendMessage(userId: string | null, sessionId: string | null, message: string): Promise<string> {
        // 1. Obtener sesión existente o crear una nueva
        let chat: IChat | null = sessionId ? await Chat.findById(sessionId) : null;
        
        if (!chat) {
            chat = await Chat.create({ userId, messages: [] });
        }

        // 2. Guardar el mensaje del usuario en el historial
        chat.messages.push({ role: 'user', content: message, timestamp: new Date() });

        // 3. Recuperar contexto de productos (RAG: Retrieval Augmented Generation)
        // Usamos el servicio de productos para buscar datos reales
        const productContext = await productService.getProductsForAI(message);
        
        const contextString = productContext.length > 0 
            ? productContext.map(p => 
                `- ${p.nombre}: $${p.precio} (Stock: ${p.stock})${p.variants?.length ? ' - Disponibilidad en variantes' : ''}`
              ).join('\n')
            : "No se encontraron productos específicos en el catálogo.";

        // 4. Preparar historial para la IA (últimos 10 mensajes)
        const history = chat.messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content
        }));

        // 5. Llamada a la IA con System Prompt definido
        try {
            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    { 
                        role: "system", 
                        content: `Eres un asistente de ventas experto de un ecommerce. 
                                  Tu objetivo es ayudar al usuario basándote EXCLUSIVAMENTE en el siguiente contexto de inventario:
                                  ${contextString}
                                  Si el producto no está en el contexto, sé honesto y dile al usuario que no lo tenemos. 
                                  Mantén respuestas cortas, amables y orientadas a la venta.` 
                    },
                    ...history
                ]
            });

            const aiResponse = completion.choices[0].message.content || "Lo siento, tuve un problema al generar la respuesta.";

            // 6. Guardar la respuesta del asistente en el historial
            chat.messages.push({ role: 'assistant', content: aiResponse, timestamp: new Date() });
            await chat.save();

            return aiResponse;

        } catch (error) {
            console.error("Error en OpenAI:", error);
            throw new AppError('El servicio de inteligencia artificial no está disponible temporalmente.', 503);
        }
    }

    /**
     * Recupera el historial completo de una sesión (para cargar el chat al abrir la ventana)
     */
    async getChatHistory(sessionId: string): Promise<IChat> {
        const chat = await Chat.findById(sessionId);
        if (!chat) throw new AppError('No se encontró el historial del chat.', 404);
        return chat;
    }
}