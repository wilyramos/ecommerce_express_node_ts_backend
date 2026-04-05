import PDFDocument from 'pdfkit';

const COMPANY = {
    nombre: "GOPHONE",
    ruc: "1072516715",
    direccion: "Jr. Bernardo O'Higgins 120",
    city: "Cañete, Lima - Perú",
    telefono: "925054636",
};

/**
 * Generador de Tickets (Ventas y Proformas)
 */
export const generateSaleTicket = (sale: any): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        const isQuote = sale.status === 'QUOTE';
        
        const doc = new PDFDocument({ 
            size: [226, 800], 
            margin: 0 
        });
        
        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        const contentWidth = 200; 
        const startX = 13;
        let currentY = 15;

        const drawLine = (y: number) => {
            doc.moveTo(startX, y).lineTo(startX + contentWidth, y).lineWidth(0.5).strokeColor('#000000').stroke();
        };

        // --- ENCABEZADO ---
        doc.font('Helvetica-Bold').fontSize(16).text(COMPANY.nombre, startX, currentY, { align: 'center', width: contentWidth });
        currentY += 18;
        doc.font('Helvetica').fontSize(8).text(`RUC: ${COMPANY.ruc}`, { align: 'center', width: contentWidth });
        currentY += 10;
        doc.text(COMPANY.direccion, { align: 'center', width: contentWidth });
        currentY += 10;
        doc.text(COMPANY.city, { align: 'center', width: contentWidth });
        currentY += 15;

        // --- TÍTULO DINÁMICO ---
        const title = isQuote ? 'PROFORMA DE VENTA' : 'TICKET DE VENTA';
        doc.font('Helvetica-Bold').fontSize(11).rect(startX, currentY - 2, contentWidth, 15).fill('#f3f4f6');
        doc.fillColor('#000000').text(title, startX, currentY, { align: 'center', width: contentWidth });
        currentY += 18;
        
        // --- INFO TRANSACCIÓN ---
        doc.font('Helvetica-Bold').fontSize(8);
        
        if (isQuote) {
            doc.text(`ID PROFORMA:`, startX, currentY);
            doc.font('Helvetica').text(sale._id.toString().slice(-8).toUpperCase(), startX + 85, currentY);
        } else {
            doc.text(`N° COMPROBANTE:`, startX, currentY);
            doc.font('Helvetica').text(sale.receiptNumber, startX + 85, currentY);
        }
        currentY += 12;

        doc.font('Helvetica-Bold').text(`FECHA EMISIÓN:`, startX, currentY);
        doc.font('Helvetica').text(new Date(sale.createdAt).toLocaleString('es-PE'), startX + 85, currentY);
        currentY += 10;

        // Fecha de Expiración (Solo para Proformas)
        if (isQuote && sale.quoteExpirationDate) {
            doc.font('Helvetica-Bold').fillColor('#d97706').text(`VÁLIDO HASTA:`, startX, currentY);
            doc.font('Helvetica').text(new Date(sale.quoteExpirationDate).toLocaleDateString('es-PE'), startX + 85, currentY);
            doc.fillColor('#000000');
            currentY += 12;
        }

        if (sale.employee) {
            doc.font('Helvetica-Bold').text(`ATENDIDO POR:`, startX, currentY);
            doc.font('Helvetica').text(sale.employee.nombre.toUpperCase(), startX + 85, currentY);
            currentY += 15;
        }

        // --- TABLA DE ITEMS ---
        drawLine(currentY);
        currentY += 5;
        doc.font('Helvetica-Bold').fontSize(7.5).text('CANT.', startX, currentY);
        doc.text('DESCRIPCIÓN', startX + 30, currentY);
        doc.text('TOTAL', startX, currentY, { align: 'right', width: contentWidth });
        currentY += 10;
        drawLine(currentY);
        currentY += 8;

        sale.items.forEach((item: any) => {
            const name = item.product?.nombre.toUpperCase() || 'PRODUCTO';
            const totalItem = (item.price * item.quantity).toFixed(2);
            
            doc.font('Helvetica-Bold').fontSize(8).text(`${item.quantity}`, startX, currentY);
            
            const nameX = startX + 30;
            const nameWidth = 120;
            const nameHeight = doc.heightOfString(name, { width: nameWidth });
            
            doc.text(name, nameX, currentY, { width: nameWidth });
            doc.text(`S/ ${totalItem}`, startX, currentY, { align: 'right', width: contentWidth });
            
            currentY += nameHeight + 2;

            if (item.variantId && item.product?.variants) {
                const variant = item.product.variants.find((v: any) => v._id.toString() === item.variantId.toString());
                if (variant) {
                    doc.font('Helvetica-Oblique').fontSize(7).text(`VAR: ${variant.nombre.toUpperCase()}`, nameX, currentY);
                    currentY += 9;
                }
            }
            currentY += 3;
        });

        currentY += 5;
        drawLine(currentY);
        currentY += 10;

        // --- TOTALES ---
        doc.font('Helvetica-Bold').fontSize(10);
        doc.text('TOTAL A PAGAR:', startX, currentY);
        doc.text(`S/ ${sale.totalPrice.toFixed(2)}`, startX, currentY, { align: 'right', width: contentWidth });
        currentY += 25;

        // --- PIE DE PÁGINA (ADAPTADO) ---
        doc.font('Helvetica-Bold').fontSize(8).text(isQuote ? 'ESTE DOCUMENTO ES UNA PROFORMA' : '¡GRACIAS POR SU COMPRA!', startX, currentY, { align: 'center', width: contentWidth });
        currentY += 12;
        
        if (isQuote) {
            doc.font('Helvetica').fontSize(7);
            doc.text('* Precios sujetos a cambios sin previo aviso.', startX, currentY, { align: 'center', width: contentWidth });
            currentY += 10;
            doc.text('* La disponibilidad de stock no está garantizada.', startX, currentY, { align: 'center', width: contentWidth });
        } else {
            doc.font('Helvetica').fontSize(7).text('Este ticket no es válido para fines tributarios.', startX, currentY, { align: 'center', width: contentWidth });
            currentY += 10;
            doc.text('Conserve su ticket para cualquier cambio.', startX, currentY, { align: 'center', width: contentWidth });
        }
        
        currentY += 15;
        doc.font('Helvetica-Bold').fontSize(8).text('www.gophone.pe', { align: 'center', width: contentWidth });

        doc.end();
    });
};