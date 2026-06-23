// File: backend/src/modules/page/page.model.ts

import { Schema, model, Document } from 'mongoose';

export interface IPage extends Document {
  title: string;             
  slug: string;              
  content: string;           
  isActive: boolean;         
  seo?: {
    metaTitle?: string;      
    metaDescription?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const PageSchema = new Schema<IPage>(
  {
    title: { 
      type: String, 
      required: true, 
      trim: true 
    },
    slug: { 
      type: String, 
      required: true, 
      unique: true, 
      trim: true, 
      lowercase: true,
      index: true 
    },
    content: { 
      type: String, 
      required: true 
    },
    isActive: { 
      type: Boolean, 
      default: true 
    },
    seo: {
      metaTitle: { type: String, trim: true },
      metaDescription: { type: String, trim: true }
    }
  },
  { 
    timestamps: true 
  }
);

PageSchema.index({ slug: 1, isActive: 1 });

export const Page = model<IPage>('Page', PageSchema);