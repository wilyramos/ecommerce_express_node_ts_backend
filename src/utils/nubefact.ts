// File: backend/src/utils/nubefact.ts

import { IOrder } from '../models/Order';

const NUBEFACT_RUTA = process.env.NUBEFACT_RUTA || '';
const NUBEFACT_TOKEN = process.env.NUBEFACT_TOKEN || '';
const SERIE_BOLETA = process.env.NUBEFACT_SERIE_BOLETA || 'BBB1';
const SERIE_NC_BOLETA = process.env.NUBEFACT_SERIE_NC_BOLETA || 'BBB1';

export interface NubefactResponse {
    tipo_de_comprobante?: number;
    serie?: string;
    numero?: number;
    enlace?: string;
    enlace_del_pdf?: string;
    enlace_del_xml?: string;
    enlace_del_cdr?: string;
    aceptada_por_sunat?: boolean;
    sunat_description?: string;
    sunat_note?: string;
    sunat_responsecode?: string;
    sunat_soap_error?: string;
    cadena_para_codigo_qr?: string;
    codigo_hash?: string;
    sunat_ticket_numero?: string;
    errors?: string;
    codigo?: number;
}

function getPeruDateFormatted(): string {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
        timeZone: 'America/Lima',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    };
    const parts = new Intl.DateTimeFormat('es-PE', options).formatToParts(now);
    const day = parts.find(p => p.type === 'day')?.value || '01';
    const month = parts.find(p => p.type === 'month')?.value || '01';
    const year = parts.find(p => p.type === 'year')?.value || '2026';

    return `${day}-${month}-${year}`;
}

export async function sendOrderToNubefact(order: IOrder): Promise<Required<Pick<NubefactResponse, 'serie' | 'numero'>> & NubefactResponse> {
    if (!NUBEFACT_RUTA || !NUBEFACT_TOKEN) {
        throw new Error('Las credenciales de Nubefact no están configuradas.');
    }

    const docType = (order.customerProfile?.tipoDocumento || 'DNI').toUpperCase();
    const docNum = order.customerProfile?.numeroDocumento?.trim() || '';

    let clienteTipoDoc = '-';
    let clienteNumeroDoc = '00000000';

    if (docType === 'DNI' && docNum.length === 8) {
        clienteTipoDoc = '1';
        clienteNumeroDoc = docNum;
    } else if (docType === 'RUC' && docNum.length === 11) {
        clienteTipoDoc = '6';
        clienteNumeroDoc = docNum;
    } else if (docType === 'CE' && docNum.length >= 6) {
        clienteTipoDoc = '4';
        clienteNumeroDoc = docNum;
    }

    const fechaEmision = getPeruDateFormatted();

    const items = order.items.map((item) => {
        const precioUnitarioConIgv = item.price;
        const valorUnitarioSinIgv = precioUnitarioConIgv / 1.18;
        const cantidad = item.quantity;

        const subtotalSinIgv = valorUnitarioSinIgv * cantidad;
        const totalItemConIgv = precioUnitarioConIgv * cantidad;
        const totalIgvItem = totalItemConIgv - subtotalSinIgv;

        return {
            unidad_de_medida: 'NIU',
            codigo: item.sku || 'PROD',
            descripcion: item.nombre,
            cantidad: cantidad,
            valor_unitario: Number(valorUnitarioSinIgv.toFixed(6)),
            precio_unitario: Number(precioUnitarioConIgv.toFixed(2)),
            subtotal: Number(subtotalSinIgv.toFixed(2)),
            tipo_de_igv: 1,
            igv: Number(totalIgvItem.toFixed(2)),
            total: Number(totalItemConIgv.toFixed(2)),
            anticipo_regularizacion: false
        };
    });

    if (order.shippingCost > 0) {
        const envioPrecioConIgv = order.shippingCost;
        const envioValorSinIgv = envioPrecioConIgv / 1.18;
        const envioIgv = envioPrecioConIgv - envioValorSinIgv;

        items.push({
            unidad_de_medida: 'ZZ',
            codigo: 'ENVIO',
            descripcion: `SERVICIO DE ENVÍO - ${order.shippingMethod || 'DELIVERY'}`,
            cantidad: 1,
            valor_unitario: Number(envioValorSinIgv.toFixed(6)),
            precio_unitario: Number(envioPrecioConIgv.toFixed(2)),
            subtotal: Number(envioValorSinIgv.toFixed(2)),
            tipo_de_igv: 1,
            igv: Number(envioIgv.toFixed(2)),
            total: Number(envioPrecioConIgv.toFixed(2)),
            anticipo_regularizacion: false
        });
    }

    const totalConIgv = order.totalPrice;
    const totalGravada = totalConIgv / 1.18;
    const totalIgv = totalConIgv - totalGravada;

    const fullAddress = `${order.shippingAddress?.direccion || ''} ${order.shippingAddress?.numero ? `N° ${order.shippingAddress.numero}` : ''} (${order.shippingAddress?.distrito || ''} - ${order.shippingAddress?.provincia || ''})`.trim();
    const nombreCliente = `${order.customerProfile?.nombre || ''} ${order.customerProfile?.apellidos || ''}`.trim().toUpperCase();

    const payload = {
        operacion: 'generar_comprobante',
        tipo_de_comprobante: 2,
        serie: SERIE_BOLETA,
        numero: null,
        codigo_unico: order.orderNumber,
        sunat_transaction: 1,
        cliente_tipo_de_documento: clienteTipoDoc,
        cliente_numero_de_documento: clienteNumeroDoc,
        cliente_denominacion: nombreCliente || 'CLIENTE FINAL',
        cliente_direccion: fullAddress || 'LIMA - PERÚ',
        cliente_email: order.customerProfile?.email || '',
        fecha_de_emision: fechaEmision,
        moneda: 1,
        porcentaje_de_igv: 18.00,
        total_gravada: Number(totalGravada.toFixed(2)),
        total_igv: Number(totalIgv.toFixed(2)),
        total: Number(totalConIgv.toFixed(2)),
        enviar_automaticamente_a_la_sunat: true,
        enviar_automaticamente_al_cliente: true,
        items
    };

    const response = await fetch(NUBEFACT_RUTA, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${NUBEFACT_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const data = (await response.json()) as NubefactResponse;

    if (!response.ok || data.errors || !data.serie || data.numero === undefined) {
        throw new Error(`Error en Nubefact: ${data.errors || response.statusText}`);
    }

    return data as Required<Pick<NubefactResponse, 'serie' | 'numero'>> & NubefactResponse;
}

// File: backend/src/utils/nubefact.ts

export async function sendCreditNoteToNubefact(order: IOrder, reason: string): Promise<NubefactResponse> {
    if (!order.invoice || !order.invoice.serie || !order.invoice.numero) {
        throw new Error('La orden no cuenta con una boleta emitida para generar nota de crédito.');
    }

    const totalConIgv = order.totalPrice;
    const totalGravada = totalConIgv / 1.18;
    const totalIgv = totalConIgv - totalGravada;
    const fechaEmision = getPeruDateFormatted();

    const items = order.items.map((item) => {
        const precioUnitarioConIgv = item.price;
        const valorUnitarioSinIgv = precioUnitarioConIgv / 1.18;
        const cantidad = item.quantity;
        const subtotalSinIgv = valorUnitarioSinIgv * cantidad;
        const totalItemConIgv = precioUnitarioConIgv * cantidad;
        const totalIgvItem = totalItemConIgv - subtotalSinIgv;

        return {
            unidad_de_medida: 'NIU',
            codigo: item.sku || 'PROD',
            descripcion: item.nombre,
            cantidad: cantidad,
            valor_unitario: Number(valorUnitarioSinIgv.toFixed(6)),
            precio_unitario: Number(precioUnitarioConIgv.toFixed(2)),
            subtotal: Number(subtotalSinIgv.toFixed(2)),
            tipo_de_igv: 1,
            igv: Number(totalIgvItem.toFixed(2)),
            total: Number(totalItemConIgv.toFixed(2)),
            anticipo_regularizacion: false
        };
    });

    const docType = (order.customerProfile?.tipoDocumento || 'DNI').toUpperCase();
    const docNum = order.customerProfile?.numeroDocumento?.trim() || '';

    let clienteTipoDoc = '-';
    let clienteNumeroDoc = '00000000';

    if (docType === 'DNI' && docNum.length === 8) {
        clienteTipoDoc = '1';
        clienteNumeroDoc = docNum;
    } else if (docType === 'RUC' && docNum.length === 11) {
        clienteTipoDoc = '6';
        clienteNumeroDoc = docNum;
    } else if (docType === 'CE' && docNum.length >= 6) {
        clienteTipoDoc = '4';
        clienteNumeroDoc = docNum;
    }

    const payload = {
        operacion: 'generar_comprobante',
        tipo_de_comprobante: 3,
        serie: SERIE_NC_BOLETA,
        numero: null,
        codigo_unico: `NC-${order.orderNumber}`,
        documento_que_se_modifica_tipo: 2,
        documento_que_se_modifica_serie: order.invoice.serie,
        documento_que_se_modifica_numero: order.invoice.numero,
        tipo_de_nota_de_credito: 1,
        observaciones: reason || 'Devolución y anulación de venta',
        cliente_tipo_de_documento: clienteTipoDoc,
        cliente_numero_de_documento: clienteNumeroDoc,
        cliente_denominacion: `${order.customerProfile?.nombre || ''} ${order.customerProfile?.apellidos || ''}`.trim().toUpperCase() || 'CLIENTE FINAL',
        cliente_email: order.customerProfile?.email || '',
        fecha_de_emision: fechaEmision,
        moneda: 1,
        porcentaje_de_igv: 18.00,
        total_gravada: Number(totalGravada.toFixed(2)),
        total_igv: Number(totalIgv.toFixed(2)),
        total: Number(totalConIgv.toFixed(2)),
        enviar_automaticamente_a_la_sunat: true,
        enviar_automaticamente_al_cliente: true,
        items
    };

    const response = await fetch(NUBEFACT_RUTA, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${NUBEFACT_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const data = (await response.json()) as NubefactResponse;

    if (!response.ok || data.errors) {
        throw new Error(`Error en Nota de Crédito Nubefact: ${data.errors || response.statusText}`);
    }

    return data;
}

export async function sendVoidToNubefact(order: IOrder, motivo: string): Promise<NubefactResponse> {
    if (!order.invoice || !order.invoice.serie || !order.invoice.numero) {
        throw new Error('No hay comprobante registrado para anular mediante Comunicación de Baja.');
    }

    const payload = {
        operacion: 'generar_anulacion',
        tipo_de_comprobante: 2, // 2 = Boleta
        serie: order.invoice.serie,
        numero: order.invoice.numero,
        motivo: motivo || 'ERROR DE SISTEMA'
    };

    const response = await fetch(NUBEFACT_RUTA, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${NUBEFACT_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const data = (await response.json()) as NubefactResponse;

    if (!response.ok || data.errors) {
        throw new Error(`Error en Comunicación de Baja Nubefact: ${data.errors || response.statusText}`);
    }

    return data;
}