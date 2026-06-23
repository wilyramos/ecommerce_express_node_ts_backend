import { Response } from 'express';

export interface IApiResponse<T = any> {
    success: boolean;
    statusCode: number;
    message: string;
    data?: T;
    meta?: {
        total?: number;
        page?: number;
        pages?: number;
        limit?: number;
    };
    timestamp: string;
}

export class ApiResponse {
    static success<T>(
        res: Response,
        statusCode: number = 200,
        message: string = 'Operación exitosa',
        data?: T,
        meta?: any
    ): Response {
        const response: IApiResponse<T> = {
            success: true,
            statusCode,
            message,
            timestamp: new Date().toISOString()
        };

        if (data !== undefined) response.data = data;
        if (meta) response.meta = meta;

        return res.status(statusCode).json(response);
    }

    static error(
        res: Response,
        statusCode: number = 500,
        message: string = 'Error interno del servidor',
        data?: any
    ): Response {
        const response: IApiResponse = {
            success: false,
            statusCode,
            message,
            timestamp: new Date().toISOString()
        };

        if (data !== undefined) response.data = data;

        return res.status(statusCode).json(response);
    }

    static paginated<T>(
        res: Response,
        data: T[],
        total: number,
        page: number,
        limit: number,
        statusCode: number = 200,
        message: string = 'Listado obtenido exitosamente'
    ): Response {
        const pages = Math.ceil(total / limit);

        return this.success(res, statusCode, message, data, {
            total,
            page,
            pages,
            limit
        });
    }
}