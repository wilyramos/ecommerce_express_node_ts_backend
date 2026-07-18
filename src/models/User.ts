// File: backend/src/models/User.ts

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
    googleId?: string;
    isActive?: boolean;
    deletedAt?: Date | null;
}

const userSchema = new Schema<IUser>({
    nombre: { type: String, required: true, trim: true },
    apellidos: { type: String, required: false, trim: true },
    tipoDocumento: { type: String, enum: ['DNI', 'RUC', 'CE'], required: false },
    numeroDocumento: { type: String, required: false, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, select: false },
    telefono: { type: String, required: false, trim: true },
    rol: {
        type: String,
        enum: ['cliente', 'administrador', 'vendedor'],
        default: 'cliente'
    },
    googleId: { type: String, required: false, unique: true, sparse: true }, // <- sparse evita conflictos si es null
    
    // ==========================================
    // CAMPOS DE ESTADO Y SEGURIDAD (Soft Delete)
    // ==========================================
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
    timestamps: true // Agrega automáticamente createdAt y updatedAt
});

userSchema.index({ rol: 1, isActive: 1 });

// Optimiza el rendimiento de getAllUsers y getAllClients que filtran por rol y ordenan por fecha
userSchema.index({ rol: 1, createdAt: -1 });

// Permite buscar por documento eficientemente si se usa en los filtros de paneles
userSchema.index({ numeroDocumento: 1 }, { sparse: true });

const User = mongoose.model<IUser>("User", userSchema);
export default User;