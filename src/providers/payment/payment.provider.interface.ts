// File: backend/src/providers/payment/payment.provider.interface.ts
export interface ICreateOrderPayload {
    // REQUERIDOS
    amount: number; // en céntimos (int >= 100, ej: 1000 = S/ 10.00)
    currency_code: string; // "PEN" | "USD"
    description: string; // máx 80 caracteres
    order_number: string; // identificador único (máx 80 caracteres)
    
    // Cliente (REQUERIDO)
    client_details: {
        first_name: string; // máx 50 caracteres
        last_name: string; // máx 50 caracteres
        email: string; // email válido
        phone_number: string; // formato: 9 dígitos sin espacios (PE: 9xxxxxxxx)
    };
    
    // OPCIONALES pero RECOMENDADOS
    expiration_date?: number; // timestamp UNIX (segundos, no milisegundos)
    metadata?: Record<string, any>; // datos adicionales
    confirm?: boolean; // false para órdenes asincrónicas (CIP/QR)
}

export interface ICreateChargePayload {
  amount: number;
  currency_code: string;
  email: string;
  source_id: string;

  antifraude_details: {
    first_name: string;
    last_name: string;
    phone_number: string;
    address: string;
    address_city: string;
    country_code: string;
    device_finger_print_id: string;
  };

  authentication_3DS?: {
    xid: string;
    cavv: string;
    eci: string;
    protocolVersion: string;
    directoryServerTransactionId?: string;
  };

  metadata?: Record<string, any>;
}

export interface IPaymentProvider {
    createOrder(payload: ICreateOrderPayload): Promise<{ id: string; [key: string]: any }>;
    createCharge(payload: ICreateChargePayload): Promise<{ id: string; [key: string]: any }>;
}