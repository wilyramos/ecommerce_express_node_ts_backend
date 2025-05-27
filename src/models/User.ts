import mongoose, { Schema, Document } from 'mongoose';

export type UserRole = 'cliente' | 'administrador' | 'vendedor';

export interface IUser extends Document {
    nombre: string;
    email: string;
    password?: string;
    direccion?: string;
    telefono?: string;
    rol?: UserRole;
}

const userSchema = new Schema<IUser>({
    nombre: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true},
    password: { type: String, select: false },
    direccion: { type: String, required: false },
    telefono: { type: String, required: false },
    rol: {
        type: String,
        enum: ['cliente', 'administrador', 'vendedor'],
        default: 'cliente'
    }
}, { timestamps: true }); // timestamps agrega automáticamente createdAt y updatedAt

const User = mongoose.model<IUser>("User", userSchema);
export default User;