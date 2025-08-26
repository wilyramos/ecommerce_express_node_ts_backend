import { Request, Response } from "express";
import mongoose from "mongoose";
import Product from "../models/Product";
import { Purchase } from "../models/Purchase";

export class PurchaseController {
    static async createPurchase(req: Request, res: Response) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { proveedor, items } = req.body;

            let total = 0;

            // Validar y preparar items
            for (const item of items) {
                const product = await Product.findById(item.productId).session(session);
                if (!product) {
                    throw new Error(`Producto no encontrado: ${item.productId}`);
                }

                const totalPrice = item.quantity * item.priceUnit;
                total += totalPrice;

                // Actualizar stock y costo promedio
                const nuevoStock = (product.stock || 0) + item.quantity;
                product.costo = item.priceUnit; // último precio de compra
                product.stock = nuevoStock;
                await product.save({ session });

                // Reemplazar el total calculado en cada item
                item.totalPrice = totalPrice;
            }

            // Crear la compra
            const nuevaCompra = new Purchase({
                proveedor,
                items,
                total,
                fecha: new Date(),
            });

            await nuevaCompra.save({ session });

            await session.commitTransaction();
            session.endSession();

            res.status(201).json(nuevaCompra);
            return;
        } catch (error: any) {
            await session.abortTransaction();
            session.endSession();
            console.error(error);
            res.status(500).json({ message: error.message || "Error al registrar la compra" });
            return;
        }
    }

    static async getPurchase(req: Request, res: Response) {
        const { id } = req.params;

        try {
            const purchase = await Purchase.findById(id).populate('items.productId');
            if (!purchase) {
                res.status(404).json({ message: 'Compra no encontrada' });
                return;
            }
            res.json(purchase);
        } catch (error: any) {
            console.error(error);
            res.status(500).json({ message: error.message || "Error al obtener la compra" });
        }
    }

    static async getPurchases(req: Request, res: Response) {
        try {

            const { query } = req;
            const page = Number(query.page) || 0;
            const limit = Number(query.limit) || 10;

            const purchases = await Purchase.find()
                .sort({ createdAt: -1 })
                .limit(limit)
                .skip(page * limit);

            const total = await Purchase.countDocuments();
            res.json({ 
                total, page, limit, purchases 
            });
        } catch (error: any) {
            console.error(error);
            res.status(500).json({ message: error.message || "Error al obtener las compras" });
        }
    }
}