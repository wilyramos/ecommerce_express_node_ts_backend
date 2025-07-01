import mongoose, { Schema, Document } from 'mongoose';

export type UserRole = 'cliente' | 'administrador' | 'vendedor';

export interface IUser extends Document {
    nombre: string;
    apellidos?: string;
    tipoDocumento?: 'DNI' | 'RUC' | 'CE';
    numeroDocumento?: string;
    email: string;
    password?: string;
    telefono?: string;
    rol?: UserRole;
}

const userSchema = new Schema<IUser>({
    nombre: { type: String, required: true },
    apellidos: { type: String, required: false },
    tipoDocumento: { type: String, enum: ['DNI', 'RUC', 'CE'], required: false },
    numeroDocumento: { type: String, required: false },
    email: { type: String, required: true, unique: true, lowercase: true},
    password: { type: String, select: false },
    telefono: { type: String, required: false },
    rol: {
        type: String,
        enum: ['cliente', 'administrador', 'vendedor'],
        default: 'cliente'
    }
}, { timestamps: true }); // timestamps agrega automáticamente createdAt y updatedAt

const User = mongoose.model<IUser>("User", userSchema);
export default User;