import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
    nombre: string;
    email: string;
    password?: string; // Opcional porque podría no estar presente después de la autenticación
    direccion?: string;
    telefono?: string;
    rol?: 'cliente' | 'administrador';
}

const userSchema = new Schema<IUser>({
    nombre: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true},
    password: { type: String, select: false }, // select: false para no devolver la contraseña en las consultas por defecto
    direccion: { type: String },
    telefono: { type: String, required: false },
    rol: { type: String, enum: ['cliente', 'administrador'], default: 'cliente' },

}, { timestamps: true }); // timestamps agrega automáticamente createdAt y updatedAt

const User = mongoose.model<IUser>("User", userSchema);
export default User;