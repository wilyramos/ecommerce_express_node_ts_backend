// File: backend/src/utils/packingSlipGenerator.ts

import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { Response } from 'express';
import { IOrder } from '../models/Order';

export type DocumentType = 'packing_slip' | 'sale_note' | 'shipping_label';
export type PageFormat = 'A4' | 'thermal_80mm';

interface PDFGeneratorOptions {
    type: DocumentType;
    format: PageFormat;
}

const LOGO_URL = 'https://www.gophone.pe/logogophone.png';

/**
 * Descarga una imagen desde una URL y devuelve un Buffer de Node.js
 */
async function fetchLogoBuffer(url: string): Promise<Buffer | null> {
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } catch (error) {
        console.error('⚠️ No se pudo cargar el logo para el PDF:', error);
        return null;
    }
}

/**
 * Helper para convertir variantAttributes (Map de Mongoose u Objeto) a un string limpio "Atributo: Valor"
 */
function formatVariantAttributes(attrs: any): string {
    if (!attrs) return '';

    let plainObj: Record<string, string> = {};

    if (attrs instanceof Map) {
        attrs.forEach((value, key) => {
            plainObj[key] = String(value);
        });
    } else if (typeof attrs === 'object' && !attrs.$__parent) {
        plainObj = attrs;
    }

    const entries = Object.entries(plainObj).filter(
        ([k]) => !k.startsWith('$') && k !== '_id'
    );

    if (entries.length === 0) return '';
    return entries.map(([k, v]) => `${k}: ${v}`).join(', ');
}

/**
 * Normaliza cualquier documento de orden proveniente de Mongoose a un POJO limpio.
 */
function sanitizeOrder(rawOrder: any): IOrder {
    if (rawOrder && typeof rawOrder.toObject === 'function') {
        return rawOrder.toObject({ getters: true, virtuals: false });
    }
    return rawOrder;
}

/**
 * Genera y transmite dinámicamente archivos PDF (A4 o Térmico 80mm) para órdenes.
 */
export async function generateOrdersPDF(
    ordersInput: IOrder[],
    res: Response,
    options: PDFGeneratorOptions
): Promise<void> {
    const isThermal = options.format === 'thermal_80mm';
    const orders = ordersInput.map(sanitizeOrder);

    // Descargar el logo una sola vez para todas las páginas de este documento
    const logoBuffer = await fetchLogoBuffer(LOGO_URL);

    // Calcular altura estimada si es ticket de 80mm (ancho de 226pt)
    let docOptions: PDFKit.PDFDocumentOptions = { size: 'A4', margin: 30 };

    if (isThermal && orders.length === 1) {
        const itemLines = orders[0].items.length * 35;
        const calculatedHeight = Math.max(380, 240 + itemLines);
        docOptions = { size: [226, calculatedHeight], margin: 10 };
    } else if (isThermal) {
        docOptions = { size: [226, 800], margin: 10 };
    }

    const doc = new PDFDocument(docOptions);

    const filename = `${options.type}_${options.format}_${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    doc.pipe(res);

    for (let index = 0; index < orders.length; index++) {
        const order = orders[index];
        if (!order) continue;

        if (index > 0) {
            doc.addPage();
        }

        const qrDataUrl = await QRCode.toDataURL(order.orderNumber, { margin: 1, width: 80 });

        if (isThermal) {
            await renderThermalDocument(doc, order, options.type, qrDataUrl, logoBuffer);
        } else {
            await renderA4Document(doc, order, options.type, qrDataUrl, logoBuffer);
        }
    }

    doc.end();
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDERIZADO FORMATO A4
// ─────────────────────────────────────────────────────────────────────────────

async function renderA4Document(
    doc: PDFKit.PDFDocument,
    order: IOrder,
    type: DocumentType,
    qrDataUrl: string,
    logoBuffer: Buffer | null
): Promise<void> {
    const isPacking = type === 'packing_slip';
    const title = isPacking ? 'GUÍA DE EMPAQUE / PACKING SLIP' : 'NOTA DE VENTA / COMPROBANTE INTERNO';

    // 1. Cabecera con Logo
    const headerTop = 30;
    if (logoBuffer) {
        doc.image(logoBuffer, 30, headerTop, { width: 110 });
    } else {
        doc.fontSize(14).font('Helvetica-Bold').text('GOPHONE.PE', 30, headerTop);
    }

    doc.fontSize(13).font('Helvetica-Bold').text(title, 150, headerTop + 5, { align: 'right' });
    doc.moveDown(1.5);

    const startY = doc.y + 15;

    doc.fontSize(9).font('Helvetica-Bold').text('ORDEN N°: ', 30, startY, { continued: true })
       .font('Helvetica').text(order.orderNumber);

    doc.font('Helvetica-Bold').text('FECHA: ', 30, doc.y, { continued: true })
       .font('Helvetica').text(new Date(order.createdAt).toLocaleDateString('es-PE'));

    doc.font('Helvetica-Bold').text('ESTADO: ', 30, doc.y, { continued: true })
       .font('Helvetica').text(order.status.toUpperCase());

    if (order.trackingNumber) {
        doc.font('Helvetica-Bold').text('TRACKING: ', 30, doc.y, { continued: true })
           .font('Helvetica').text(order.trackingNumber);
    }

    // QR arriba a la derecha
    const qrBuffer = Buffer.from(qrDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
    doc.image(qrBuffer, 485, startY - 5, { width: 60, height: 60 });

    // 2. Bloques de Información (Cliente / Envío)
    doc.moveDown(1.5);
    const boxY = doc.y;

    // Recuadro Cliente
    doc.rect(30, boxY, 260, 85).stroke('#cbd5e1');
    doc.fontSize(9).font('Helvetica-Bold').text('CLIENTE', 40, boxY + 8);
    doc.fontSize(8).font('Helvetica')
       .text(`Nombre: ${order.customerProfile?.nombre || ''} ${order.customerProfile?.apellidos || ''}`, 40, boxY + 22)
       .text(`Email: ${order.customerProfile?.email || ''}`, 40, boxY + 36)
       .text(`Teléfono: ${order.customerProfile?.telefono || ''}`, 40, boxY + 50)
       .text(`Doc: ${order.customerProfile?.tipoDocumento || 'DOC'}: ${order.customerProfile?.numeroDocumento || 'N/A'}`, 40, boxY + 64);

    // Recuadro Envío
    doc.rect(300, boxY, 265, 85).stroke('#cbd5e1');
    doc.fontSize(9).font('Helvetica-Bold').text('DIRECCIÓN DE DESPACHO', 310, boxY + 8);
    doc.fontSize(8).font('Helvetica')
       .text(`Dirección: ${order.shippingAddress?.direccion || ''} ${order.shippingAddress?.numero || ''}`, 310, boxY + 22)
       .text(`Ubicación: ${order.shippingAddress?.distrito || ''} - ${order.shippingAddress?.provincia || ''} - ${order.shippingAddress?.departamento || ''}`, 310, boxY + 36)
       .text(`Ref: ${order.shippingAddress?.referencia || 'Sin referencia'}`, 310, boxY + 50)
       .text(`Método: ${order.shippingMethod || 'Estándar'}`, 310, boxY + 64);

    // 3. Tabla de Productos
    doc.moveDown(6);
    const tableY = doc.y + 10;

    doc.rect(30, tableY, 535, 20).fill('#0f172a');
    doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');

    if (isPacking) {
        doc.text('SKU', 40, tableY + 6);
        doc.text('DESCRIPCIÓN DEL PRODUCTO', 140, tableY + 6);
        doc.text('CANT.', 480, tableY + 6, { width: 35, align: 'center' });
        doc.text('VERIF.', 525, tableY + 6, { width: 35, align: 'center' });
    } else {
        doc.text('SKU', 40, tableY + 6);
        doc.text('PRODUCTO', 140, tableY + 6);
        doc.text('PRECIO U.', 370, tableY + 6, { width: 60, align: 'right' });
        doc.text('CANT.', 440, tableY + 6, { width: 35, align: 'center' });
        doc.text('TOTAL', 485, tableY + 6, { width: 70, align: 'right' });
    }

    let currentY = tableY + 20;
    doc.fillColor('#000000').font('Helvetica');

    order.items.forEach((item: any, i: number) => {
        const bgRow = i % 2 === 0 ? '#f8fafc' : '#ffffff';
        doc.rect(30, currentY, 535, 22).fill(bgRow);
        doc.fillColor('#000000').fontSize(8);

        const sku = item.sku || 'N/A';
        doc.text(sku, 40, currentY + 6);

        let rawName = item.nombre || 'Producto';
        const formattedAttrs = formatVariantAttributes(item.variantAttributes);
        
        if (formattedAttrs && !rawName.includes('(')) {
            rawName += ` (${formattedAttrs})`;
        }

        if (isPacking) {
            doc.text(rawName, 140, currentY + 6, { width: 330, height: 14, ellipsis: true });
            doc.font('Helvetica-Bold').text(String(item.quantity), 480, currentY + 6, { width: 35, align: 'center' }).font('Helvetica');
            doc.rect(537, currentY + 5, 11, 11).stroke('#64748b');
        } else {
            doc.text(rawName, 140, currentY + 6, { width: 220, height: 14, ellipsis: true });
            doc.text(`${order.currency} ${(item.price || 0).toFixed(2)}`, 370, currentY + 6, { width: 60, align: 'right' });
            doc.font('Helvetica-Bold').text(String(item.quantity), 440, currentY + 6, { width: 35, align: 'center' }).font('Helvetica');
            doc.text(`${order.currency} ${((item.price || 0) * item.quantity).toFixed(2)}`, 485, currentY + 6, { width: 70, align: 'right' });
        }

        currentY += 22;
    });

    // 4. Resumen Monetario o Firmas
    if (!isPacking) {
        doc.moveDown(1);
        const totalsY = currentY + 10;
        doc.fontSize(8).font('Helvetica');

        doc.text('Subtotal:', 380, totalsY, { width: 80, align: 'right' });
        doc.font('Helvetica-Bold').text(`${order.currency} ${(order.subtotal || 0).toFixed(2)}`, 470, totalsY, { width: 85, align: 'right' }).font('Helvetica');

        doc.text('Costo Envío:', 380, totalsY + 14, { width: 80, align: 'right' });
        doc.font('Helvetica-Bold').text(`${order.currency} ${(order.shippingCost || 0).toFixed(2)}`, 470, totalsY + 14, { width: 85, align: 'right' }).font('Helvetica');

        doc.fontSize(10).font('Helvetica-Bold').text('TOTAL:', 380, totalsY + 30, { width: 80, align: 'right' });
        doc.text(`${order.currency} ${(order.totalPrice || 0).toFixed(2)}`, 470, totalsY + 30, { width: 85, align: 'right' });
    } else {
        const footerY = 720;
        doc.rect(30, footerY, 535, 75).stroke('#cbd5e1');
        doc.fontSize(8).font('Helvetica-Bold').text('CONTROL DE EMBALAJE Y CONFORMIDAD', 40, footerY + 8);

        doc.lineCap('butt').moveTo(50, footerY + 55).lineTo(200, footerY + 55).stroke('#94a3b8');
        doc.fontSize(7).font('Helvetica').text('Firma Almacén / Empacador', 50, footerY + 58, { width: 150, align: 'center' });

        doc.lineCap('butt').moveTo(360, footerY + 55).lineTo(510, footerY + 55).stroke('#94a3b8');
        doc.fontSize(7).font('Helvetica').text('Firma Transportista / Courier', 360, footerY + 58, { width: 150, align: 'center' });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDERIZADO FORMATO TÉRMICO 80MM (TICKETERA)
// ─────────────────────────────────────────────────────────────────────────────

async function renderThermalDocument(
    doc: PDFKit.PDFDocument,
    order: IOrder,
    type: DocumentType,
    qrDataUrl: string,
    logoBuffer: Buffer | null
): Promise<void> {
    const isPacking = type === 'packing_slip';
    const title = isPacking ? 'TICKET DE EMPAQUE' : 'NOTA DE VENTA';

    if (logoBuffer) {
        doc.image(logoBuffer, 73, 10, { width: 80 });
        doc.moveDown(2.2);
    } else {
        doc.fontSize(10).font('Helvetica-Bold').text('GOPHONE.PE', { align: 'center' });
        doc.moveDown(0.2);
    }

    doc.fontSize(8).font('Helvetica-Bold').text(title, { align: 'center' });
    doc.moveDown(0.3);

    doc.fontSize(7.5).font('Helvetica');
    doc.text(`Orden: ${order.orderNumber}`);
    doc.text(`Fecha: ${new Date(order.createdAt).toLocaleDateString('es-PE')}`);
    doc.text(`Cliente: ${order.customerProfile?.nombre || ''} ${order.customerProfile?.apellidos || ''}`);
    doc.text(`Teléf: ${order.customerProfile?.telefono || 'N/A'}`);
    doc.text(`Dir: ${order.shippingAddress?.direccion || ''} ${order.shippingAddress?.numero || ''}`);
    doc.text(`Ubic: ${order.shippingAddress?.distrito || ''} - ${order.shippingAddress?.provincia || ''}`);
    if (order.trackingNumber) doc.text(`Tracking: ${order.trackingNumber}`);

    doc.moveDown(0.3);
    doc.text('----------------------------------------------------');

    order.items.forEach((item: any) => {
        let name = item.nombre || 'Producto';
        const formattedAttrs = formatVariantAttributes(item.variantAttributes);

        if (formattedAttrs && !name.includes('(')) {
            name += ` (${formattedAttrs})`;
        }

        doc.font('Helvetica-Bold').fontSize(7.5).text(`${item.quantity}x ${name}`);
        if (!isPacking) {
            const unitPrice = (item.price || 0).toFixed(2);
            const itemTotal = ((item.price || 0) * item.quantity).toFixed(2);
            doc.font('Helvetica').fontSize(7).text(`    P.U: ${order.currency} ${unitPrice} | Total: ${order.currency} ${itemTotal}`);
        }
        doc.moveDown(0.2);
    });

    doc.text('----------------------------------------------------');

    if (!isPacking) {
        doc.font('Helvetica').fontSize(7.5).text(`Subtotal: ${order.currency} ${(order.subtotal || 0).toFixed(2)}`, { align: 'right' });
        doc.text(`Envío: ${order.currency} ${(order.shippingCost || 0).toFixed(2)}`, { align: 'right' });
        doc.font('Helvetica-Bold').fontSize(9).text(`TOTAL: ${order.currency} ${(order.totalPrice || 0).toFixed(2)}`, { align: 'right' });
    }

    doc.moveDown(0.5);
    const qrBuffer = Buffer.from(qrDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
    doc.image(qrBuffer, 78, doc.y, { width: 70, height: 70 });
}