// File: backend/src/models/Favorite.ts
import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IFavorite extends Document {
    user: Types.ObjectId;
    product: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}

const favoriteSchema = new Schema<IFavorite>({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true }
}, { timestamps: true });

// Índice compuesto único: un usuario no puede tener el mismo producto dos veces en favoritos
favoriteSchema.index({ user: 1, product: 1 }, { unique: true });

const Favorite = mongoose.model<IFavorite>('Favorite', favoriteSchema);
export default Favorite;