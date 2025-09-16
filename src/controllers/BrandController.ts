import { Request, Response } from 'express';
import Brand from '../models/Brand';


export class BrandController {
    static async createBrand(req: Request, res: Response) {
        const { nombre, descripcion } = req.body;

        try {
            const existingBrand = await Brand.findOne({ nombre });
            if (existingBrand) {
                res.status(400).json({ message: 'Brand name already exists' });
                return;
            }
            const slug = nombre.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');

            const newBrand = new Brand({
                nombre,
                slug,
                descripcion
            });
            await newBrand.save();
            res.status(201).json(newBrand);
        } catch (error) {
            console.error('Error creating brand:', error);
            res.status(500).json({ message: 'Server error' });
            return;
        }
    }

    static async getBrands(req: Request, res: Response) {
        try {
            const brands = await Brand.find();
            res.status(200).json(brands)
                
        } catch (error) {
            console.error('Error fetching brands:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }

    static async getBrandById(req: Request, res: Response) {
        const { id } = req.params;
        try {
            const brand = await Brand.findById(id);
            if (!brand) {
                res.status(404).json({ message: 'Brand not found' });
                return;
            }
            res.status(200).json(brand);
        } catch (error) {
            console.error('Error fetching brand:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }

    static async updateBrand(req: Request, res: Response) {
        const { id } = req.params;
        const { nombre, descripcion } = req.body;

        try {
            const brand = await Brand.findById(id);
            if (!brand) {
                res.status(404).json({ message: 'Brand not found' });
                return;
            }

            brand.nombre = nombre;
            brand.descripcion = descripcion;
            await brand.save();

            res.status(200).json(brand);
        } catch (error) {
            console.error('Error updating brand:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }

    static async deleteBrand(req: Request, res: Response) {
        const { id } = req.params;

        try {
            const brand = await Brand.findById(id);
            if (!brand) {
                res.status(404).json({ message: 'Brand not found' });
                return;
            }
            await brand.deleteOne();
            res.status(200).json({ message: 'Brand deleted' });
        } catch (error) {
            console.error('Error deleting brand:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }

    static async uploadBrandImage(req: Request, res: Response) {
        
        res.json({message: 'Not implemented yet'});
    }
}