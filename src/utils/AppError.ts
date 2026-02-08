


export class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;

    constructor(message: string, statusCode: number) {
        super(message);
        this.statusCode = statusCode;
        // Errores operacionales son errores que podemos prever (ej. 404, 400)
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}