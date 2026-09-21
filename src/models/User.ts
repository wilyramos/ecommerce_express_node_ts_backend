// File: backend/src/models/User.ts

import mongoose, { Schema, Document } from 'mongoose';

export type UserRole = 'cliente' | 'administrador' | 'vendedor';

export interface IUserAddress {
    departamento?: string;
    provincia?: string;
    distrito?: string;
    direccion?: string;
    numero?: string;
    pisoDpto?: string;
    referencia?: string;
}

export interface IUser extends Document {
    nombre: string;
    apellidos?: string;
    tipoDocumento?: 'DNI' | 'RUC' | 'CE';
    numeroDocumento?: string;
    email: string;
    password?: string;
    telefono?: string;
    direccion?: IUserAddress;
    rol?: UserRole;
    googleId?: string;
    isActive?: boolean;
    deletedAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
}

const userAddressSchema = new Schema<IUserAddress>({
    departamento: { type: String, trim: true },
    provincia: { type: String, trim: true },
    distrito: { type: String, trim: true },
    direccion: { type: String, trim: true },
    numero: { type: String, trim: true },
    pisoDpto: { type: String, trim: true },
    referencia: { type: String, trim: true }
}, { _id: false });

const userSchema = new Schema<IUser>({
    nombre: { type: String, required: true, trim: true },
    apellidos: { type: String, required: false, trim: true },
    tipoDocumento: { type: String, enum: ['DNI', 'RUC', 'CE'], required: false },
    numeroDocumento: { type: String, required: false, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, select: false },
    telefono: { type: String, required: false, trim: true },
    direccion: { type: userAddressSchema, required: false, default: {} },
    rol: {
        type: String,
        enum: ['cliente', 'administrador', 'vendedor'],
        default: 'cliente'
    },
    googleId: { type: String, required: false, unique: true, sparse: true },
    isActive: {
        type: Boolean,
        required: true,
        default: true
    },
    deletedAt: {
        type: Date,
        required: false,
        default: null
    }
}, {
    timestamps: true
});

userSchema.index({ rol: 1, isActive: 1 });
userSchema.index({ rol: 1, createdAt: -1 });
userSchema.index({ numeroDocumento: 1 }, { sparse: true });

const User = mongoose.model<IUser>("User", userSchema);
export default User;