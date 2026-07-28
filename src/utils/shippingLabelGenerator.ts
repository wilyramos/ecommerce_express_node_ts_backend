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
 * Rótulo Adhesivo Limpio para Caja (10x15 cm)
 * Optimizado para admisión directa en Olva Courier y Shalom
 */
export async function generateShippingLabelsPDF(
    ordersInput: IOrder[],
    res: Response
): Promise<void> {
    const orders = ordersInput.map(sanitizeOrder);

    const doc = new PDFDocument({ size: [288, 432], margin: 12 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="rotulos_caja_${Date.now()}.pdf"`);

    doc.pipe(res);

    for (let index = 0; index < orders.length; index++) {
        const order = orders[index];
        if (!order) continue;

        if (index > 0) {
            doc.addPage();
        }

        const qrDataUrl = await QRCode.toDataURL(order.orderNumber, { margin: 0, width: 70 });
        const qrBuffer = Buffer.from(qrDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');

        // 1. DESTINO EN CABECERA (GIGANTE)
        const department = (order.shippingAddress?.departamento || '').toUpperCase();
        const province = (order.shippingAddress?.provincia || '').toUpperCase();
        const district = (order.shippingAddress?.distrito || '').toUpperCase();

        doc.rect(12, 12, 264, 46).fill('#000000');
        doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold');
        doc.text(`${department} - ${province}`, 12, 20, { width: 264, align: 'center' });
        doc.fontSize(12).font('Helvetica').text(district, 12, 38, { width: 264, align: 'center' });

        // 2. DESTINATARIO
        let currentY = 72;
        doc.fillColor('#000000').fontSize(8).font('Helvetica-Bold').text('DESTINATARIO:', 14, currentY);

        currentY += 12;
        const fullName = `${order.customerProfile?.nombre || ''} ${order.customerProfile?.apellidos || ''}`.toUpperCase();
        doc.fontSize(13).font('Helvetica-Bold').text(fullName, 14, currentY, { width: 260, height: 32, ellipsis: true });

        currentY += 32;
        const docType = order.customerProfile?.tipoDocumento || 'DNI';
        const docNum = order.customerProfile?.numeroDocumento || '-------';
        const phone = order.customerProfile?.telefono || '-------';

        doc.fontSize(11).font('Helvetica-Bold')
           .text(`${docType}: `, 14, currentY, { continued: true })
           .font('Helvetica').text(docNum)
           .font('Helvetica-Bold').text(`   TEL: `, { continued: true })
           .font('Helvetica').text(phone);

        // 3. DIRECCIÓN
        currentY += 22;
        doc.fontSize(8).font('Helvetica-Bold').text('DIRECCIÓN / AGENCIA:', 14, currentY);

        currentY += 12;
        const fullAddress = `${order.shippingAddress?.direccion || ''} ${order.shippingAddress?.numero ? `N° ${order.shippingAddress.numero}` : ''} ${order.shippingAddress?.pisoDpto || ''}`.trim();
        doc.fontSize(10).font('Helvetica')
           .text(fullAddress || 'RECOJO EN AGENCIA', 14, currentY, { width: 260, height: 36, ellipsis: true });

        currentY += 38;
        if (order.shippingAddress?.referencia) {
            doc.fontSize(8.5).font('Helvetica-Oblique')
               .text(`Ref: ${order.shippingAddress.referencia}`, 14, currentY, { width: 260, height: 24, ellipsis: true });
        }

        // 4. PIE DE PÁGINA
        const footerY = 340;
        doc.moveTo(12, footerY).lineTo(276, footerY).lineWidth(1).stroke('#000000');

        doc.image(qrBuffer, 204, footerY + 10, { width: 60, height: 60 });

        doc.fontSize(8).font('Helvetica-Bold').text('REMITENTE:', 14, footerY + 10);
        doc.fontSize(7.5).font('Helvetica')
           .text('E-COMMERCE STORE', 14, footerY + 22)
           .text('RUC: 20600000001', 14, footerY + 33)
           .text('TEL: 900 000 000', 14, footerY + 44);

        doc.fontSize(8.5).font('Helvetica-Bold').text('FRÁGIL', 14, footerY + 58);
    }

    doc.end();
}