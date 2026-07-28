// File: backend/src/utils/shippingLabelGenerator.ts

import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { Response } from 'express';
import { IOrder } from '../models/Order';

function sanitizeOrder(rawOrder: any): IOrder {
    if (rawOrder && typeof rawOrder.toObject === 'function') {
        return rawOrder.toObject({ getters: true, virtuals: false });
    }
    return rawOrder;
}

/**
 * Rótulo Adhesivo Estándar para Caja (10x15 cm)
 * Estructura simple, alineada y ordenada
 */
export async function generateShippingLabelsPDF(
    ordersInput: IOrder[],
    res: Response
): Promise<void> {
    const orders = ordersInput.map(sanitizeOrder);

    // Formato Estándar 10x15 cm (288 x 432 puntos a 72 DPI)
    const doc = new PDFDocument({ size: [288, 432], margin: 0 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="rotulo_caja_${Date.now()}.pdf"`);

    doc.pipe(res);

    const LEFT = 14;
    const RIGHT_EDGE = 274;
    const WIDTH = RIGHT_EDGE - LEFT;

    for (let index = 0; index < orders.length; index++) {
        const order = orders[index];
        if (!order) continue;

        if (index > 0) doc.addPage();

        const qrDataUrl = await QRCode.toDataURL(order.orderNumber, { margin: 0, width: 60 });
        const qrBuffer = Buffer.from(qrDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');

        let y = 14;

        // Borde exterior
        doc.rect(LEFT - 1, 10, WIDTH + 2, 412).lineWidth(1).stroke('#000000');

        // ──────────────────────────────────────────────────────────
        // DESTINATARIO - NOMBRE Y CONTACTO
        // ──────────────────────────────────────────────────────────
        doc.fillColor('#000000').fontSize(7).font('Helvetica-Bold')
           .text('DESTINATARIO', LEFT, y);
        y += 8;

        const fullName = `${order.customerProfile?.nombre || ''} ${order.customerProfile?.apellidos || ''}`.toUpperCase();
        doc.fillColor('#000000').fontSize(10.5).font('Helvetica-Bold')
           .text(fullName, LEFT, y, { width: WIDTH, ellipsis: true });
        y += 16;

        const docType = order.customerProfile?.tipoDocumento || 'DNI';
        const docNum = order.customerProfile?.numeroDocumento || '-------';
        doc.fontSize(8).font('Helvetica-Bold')
           .text(`${docType}:`, LEFT, y);
        doc.font('Helvetica')
           .text(docNum, LEFT + 32, y);
        y += 9;

        const phone = order.customerProfile?.telefono || '-------';
        doc.font('Helvetica-Bold').fontSize(8)
           .text('TEL:', LEFT, y);
        doc.font('Helvetica')
           .text(phone, LEFT + 28, y);
        y += 12;

        // Línea divisoria
        doc.moveTo(LEFT, y).lineTo(RIGHT_EDGE, y).lineWidth(1).stroke('#000000');
        y += 10;

        // ──────────────────────────────────────────────────────────
        // UBICACIÓN - DESGLOSADA
        // ──────────────────────────────────────────────────────────
        doc.fillColor('#000000').fontSize(7).font('Helvetica-Bold')
           .text('DEPARTAMENTO:', LEFT, y);
        const department = (order.shippingAddress?.departamento || 'N/A').toUpperCase();
        doc.font('Helvetica').fontSize(9)
           .text(department, LEFT + 65, y - 1);
        y += 10;

        doc.font('Helvetica-Bold').fontSize(7)
           .text('PROVINCIA:', LEFT, y);
        const province = (order.shippingAddress?.provincia || 'N/A').toUpperCase();
        doc.font('Helvetica').fontSize(9)
           .text(province, LEFT + 65, y - 1);
        y += 10;

        doc.font('Helvetica-Bold').fontSize(7)
           .text('DISTRITO:', LEFT, y);
        const district = (order.shippingAddress?.distrito || 'N/A').toUpperCase();
        doc.font('Helvetica').fontSize(9)
           .text(district, LEFT + 65, y - 1);
        y += 12;

        // Línea divisoria
        doc.moveTo(LEFT, y).lineTo(RIGHT_EDGE, y).lineWidth(1).stroke('#000000');
        y += 10;

        // ──────────────────────────────────────────────────────────
        // DIRECCIÓN DETALLADA
        // ──────────────────────────────────────────────────────────
        doc.fontSize(7).font('Helvetica-Bold')
           .text('VÍA:', LEFT, y);
        const street = (order.shippingAddress?.direccion || 'N/A').toUpperCase();
        doc.font('Helvetica').fontSize(8.5)
           .text(street, LEFT + 28, y, { width: WIDTH - 28, ellipsis: true });
        y += 10;

        doc.font('Helvetica-Bold').fontSize(7)
           .text('NRO:', LEFT, y);
        const number = order.shippingAddress?.numero || '---';
        doc.font('Helvetica').fontSize(8.5)
           .text(number.toString(), LEFT + 28, y);
        y += 9;

        doc.font('Helvetica-Bold').fontSize(7)
           .text('PISO/DPTO:', LEFT, y);
        const apt = order.shippingAddress?.pisoDpto || '---';
        doc.font('Helvetica').fontSize(8.5)
           .text(apt, LEFT + 50, y);
        y += 9;

        if (order.shippingAddress?.referencia) {
            doc.font('Helvetica-Bold').fontSize(7)
               .text('REFERENCIA:', LEFT, y);
            doc.font('Helvetica-Oblique').fontSize(8)
               .text(order.shippingAddress.referencia, LEFT + 55, y, { width: WIDTH - 55, ellipsis: true });
            y += 10;
        }

        // Línea divisoria
        y += 4;
        doc.moveTo(LEFT, y).lineTo(RIGHT_EDGE, y).lineWidth(1).stroke('#000000');

        // ──────────────────────────────────────────────────────────
        // FOOTER: Remitente + Frágil + QR
        // ──────────────────────────────────────────────────────────
        const footerY = 330;
        doc.moveTo(LEFT, footerY).lineTo(RIGHT_EDGE, footerY).lineWidth(1).stroke('#000000');

        // Remitente izquierda
        doc.fillColor('#000000').fontSize(6).font('Helvetica-Bold')
           .text('REMITENTE:', LEFT, footerY + 8);
        doc.fontSize(8.5).font('Helvetica-Bold')
           .text('GOPHONE.PE', LEFT, footerY + 16);
        doc.fontSize(7).font('Helvetica')
           .text('TEL: 925 254 636', LEFT, footerY + 24);

        // Frágil
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000')
           .text('FRÁGIL', LEFT, footerY + 42);

        // QR derecha
        doc.image(qrBuffer, RIGHT_EDGE - 64, footerY + 8, { width: 58, height: 58 });
    }

    doc.end();
}