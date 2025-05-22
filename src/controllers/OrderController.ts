import Order from '../models/Order';



export class OrderController {

    static async createOrder(req: any, res: any) {
        try {
            const orderData = req.body;

            // Crear la orden
            const newOrder = new Order({
                user: orderData.userId,
                items: orderData.items,
                totalPrice: orderData.totalPrice,
                status: "PENDIENTE",
                shippingAddress: orderData.shippingAddress,
                paymentMethod: orderData.paymentMethod,
            });

            await newOrder.save();

            res.status(201).json(newOrder);
        } catch (error) {
            res.status(500).json({ message: 'Error al crear la orden' });
            return;
        }

    }

}