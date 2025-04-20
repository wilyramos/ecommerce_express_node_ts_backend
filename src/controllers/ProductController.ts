import { Request, Response } from 'express';




export class ProductController {

    static async createProduct(req: Request, res: Response) {

        console.log("from createProduct controller", req.body);

        res.status(201).json({ message: "Product created successfully" });
    }   
    

}