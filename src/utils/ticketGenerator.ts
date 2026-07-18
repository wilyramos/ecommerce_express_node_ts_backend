// File: backend/src/utils/ticketGenerator.ts

import PDFDocument from 'pdfkit';

const COMPANY = {
    nombre: "GOPHONE.PE",
    ruc: "10725169715",
    city: "San Vicente de Cañete, Lima - Perú",
    telefono: "925054636",
};

/**
 * Descarga el logo oficial en memoria antes de compilar el PDF
 */
async function fetchLogoBuffer(url: string): Promise<Buffer | null> {
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } catch (error) {
        console.error("⚠️ No se pudo cargar el logo remoto para el ticket:", error);
        return null;
    }
}

export const generateSaleTicket = async (sale: any): Promise<Buffer> => {
    const logoBuffer = await fetchLogoBuffer("https://www.gophone.pe/logogophone.png");

    return new Promise((resolve, reject) => {
        const isQuote = sale.status === 'QUOTE';
        const contentWidth = 196; // Ancho útil para papel de 80mm
        const startX = 15;
        
        // ─── CÁLCULO PRECISO DE ALTURA DINÁMICA ───
        // Inicializamos una instancia temporal ligera solo para medir textos largos
        const measurementDoc = new PDFDocument({ size: [226, 800] });
        let estimatedHeight = 250; // Base fija aproximada (Cabecera + Totales + Footer)

        sale.items.forEach((item: any) => {
            const name = item.product?.nombre ? item.product.nombre.trim() : 'PRODUCTO';
            // Medimos exactamente cuántas líneas tomará el nombre en un ancho de 114px
            const nameHeight = measurementDoc.font('Helvetica-Bold').fontSize(8).heightOfString(name, { width: 114 });
            estimatedHeight += nameHeight + 10; // Alto del nombre + margen / variante
        });
        measurementDoc.end();

        const finalHeight = Math.max(estimatedHeight, 380);

        const doc = new PDFDocument({ 
            size: [226, finalHeight], 
            margin: 0 
        });
        
        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        // Control estricto de Y para evitar colisiones
        let currentY = 20;

        const drawLine = (y: number, color = '#e5e7eb', thickness = 0.5) => {
            doc.moveTo(startX, y).lineTo(startX + contentWidth, y).lineWidth(thickness).strokeColor(color).stroke();
        };

        const formatPrice = (amount: number) => `S/ ${amount.toFixed(2)}`;

        // ─── 1. LOGO OFICIAL ───
        if (logoBuffer) {
            try {
                const logoWidth = 110;
                const logoX = startX + (contentWidth - logoWidth) / 2;
                doc.image(logoBuffer, logoX, currentY, { width: logoWidth });
                currentY += 35; 
            } catch (e) {
                doc.font('Helvetica-Bold').fontSize(12).fillColor('#000000').text(COMPANY.nombre, startX, currentY, { align: 'center', width: contentWidth });
                currentY += 16;
            }
        } else {
            doc.font('Helvetica-Bold').fontSize(12).fillColor('#000000').text(COMPANY.nombre, startX, currentY, { align: 'center', width: contentWidth });
            currentY += 16;
        }

        // ─── 2. DETALLES DE LA EMPRESA ───
        currentY += 5;
        doc.font('Helvetica').fontSize(7.5).fillColor('#8e8e93')
           .text(`RUC: ${COMPANY.ruc}`, startX, currentY, { align: 'center', width: contentWidth });
        currentY += 10;
        doc.text(COMPANY.city, startX, currentY, { align: 'center', width: contentWidth });
        currentY += 18;

        // ─── 3. TÍTULO DEL COMPROBANTE ───
        const title = isQuote ? 'PROFORMA DE VENTA' : 'COMPROBANTE DE VENTA';
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000').text(title, startX, currentY, { align: 'center', width: contentWidth });
        currentY += 14;
        
        drawLine(currentY, '#e5e7eb', 0.5);
        currentY += 8;

        // ─── 4. DATOS DE LA TRANSACCIÓN ───
        const labelCol = startX;
        const valueCol = startX + 75;

        const addInfoRow = (label: string, value: string, isHighlight = false) => {
            doc.font('Helvetica').fontSize(7.5).fillColor('#8e8e93').text(label, labelCol, currentY);
            doc.font(isHighlight ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.5).fillColor('#000000').text(value, valueCol, currentY, { width: contentWidth - 75, align: 'right' });
            currentY += 11;
        };

        if (isQuote) {
            addInfoRow('Referencia:', sale._id.toString().slice(-8).toUpperCase());
        } else {
            addInfoRow('Número:', sale.receiptNumber || '---', true);
        }

        addInfoRow('Fecha:', new Date(sale.createdAt).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }));

        if (isQuote && sale.quoteExpirationDate) {
            addInfoRow('Validez hasta:', new Date(sale.quoteExpirationDate).toLocaleDateString('es-PE'));
        }

        if (sale.customerSnapshot?.nombre) {
            // Si el nombre del cliente es extremadamente largo, dejamos que adecúe su espacio vertical
            doc.font('Helvetica').fontSize(7.5).fillColor('#8e8e93').text('Cliente:', labelCol, currentY);
            doc.font('Helvetica').fontSize(7.5).fillColor('#000000').text(sale.customerSnapshot.nombre.toUpperCase(), valueCol, currentY, { width: contentWidth - 75, align: 'right' });
            currentY += doc.heightOfString(sale.customerSnapshot.nombre.toUpperCase(), { width: contentWidth - 75 }) + 2;

            if (sale.customerSnapshot.numeroDocumento) {
                addInfoRow('Documento:', sale.customerSnapshot.numeroDocumento);
            }
        }

        currentY += 4;
        drawLine(currentY, '#000000', 0.6);
        currentY += 8;

        // ─── 5. SECCIÓN DE ARTÍCULOS (Alineación a prueba de nombres largos) ───
        sale.items.forEach((item: any) => {
            const name = item.product?.nombre ? item.product.nombre.trim() : 'PRODUCTO';
            const totalItem = item.price * item.quantity;
            
            const nameX = startX + 22;
            const nameWidth = 114;
            
            // 1. Renderizar la cantidad fija a la izquierda
            doc.font('Helvetica').fontSize(8).fillColor('#8e8e93').text(`${item.quantity}x`, startX, currentY);
            
            // 2. Renderizar el precio fijo a la extrema derecha alineado con la primera línea del artículo
            doc.font('Helvetica-Bold').fontSize(8).fillColor('#000000').text(formatPrice(totalItem), startX + 130, currentY, { align: 'right', width: contentWidth - 130 });
            
            // 3. Renderizar el nombre del producto en medio (con ancho limitado)
            doc.text(name, nameX, currentY, { width: nameWidth, lineGap: 1 });
            
            // 4. Calcular el alto real que ocupó ese bloque de texto en el PDF
            const nameHeight = doc.heightOfString(name, { width: nameWidth });
            currentY += nameHeight + 2;

            // Renderizar la variante si existe, justo debajo del espacio que dejó el nombre
            if (item.variantId && item.product?.variants) {
                const variant = item.product.variants.find((v: any) => v._id.toString() === item.variantId.toString());
                if (variant) {
                    doc.font('Helvetica-Oblique').fontSize(7).fillColor('#8e8e93').text(`Variante: ${variant.nombre}`, nameX, currentY);
                    currentY += 9;
                }
            }
            currentY += 4; // Margen de separación entre productos
        });

        currentY += 2;
        drawLine(currentY, '#e5e7eb', 0.5);
        currentY += 8;

        // ─── 6. RESUMEN DE TOTALES ───
        const total = sale.totalPrice;
        const subtotal = total / 1.18;
        const igv = total - subtotal;

        const addTotalRow = (label: string, value: string, isMain = false) => {
            doc.font(isMain ? 'Helvetica-Bold' : 'Helvetica').fontSize(isMain ? 9 : 7.5).fillColor('#000000');
            if (!isMain) doc.fillColor('#8e8e93');
            
            doc.text(label, startX + 40, currentY, { align: 'right', width: 80 });
            doc.text(value, startX + 126, currentY, { align: 'right', width: 70 });
            currentY += isMain ? 12 : 10;
        };

        addTotalRow('Subtotal:', formatPrice(subtotal));
        addTotalRow('IGV (18%):', formatPrice(igv));
        currentY += 3;
        addTotalRow('TOTAL NETO:', formatPrice(total), true);

        currentY += 10;
        drawLine(currentY, '#000000', 0.6);
        currentY += 10;

        // ─── 7. PIE DE PÁGINA ───
        doc.font('Helvetica-Bold').fontSize(7).fillColor('#000000').text(
            isQuote ? 'ESTE DOCUMENTO ES UNA PROFORMA' : 'GRACIAS POR TU VISITA', 
            startX, currentY, { align: 'center', width: contentWidth }
        );
        currentY += 10;
        
        doc.font('Helvetica').fontSize(6).fillColor('#8e8e93');
        if (isQuote) {
            doc.text('Los precios pueden variar de acuerdo a la disponibilidad de stock.', { align: 'center', width: contentWidth });
        } else {
            doc.text('Este documento no posee validez tributaria.', { align: 'center', width: contentWidth });
            doc.text('Conserva este comprobante para validar la garantía.', { align: 'center', width: contentWidth });
        }
        
        currentY += 12;
        doc.font('Helvetica-Bold').fontSize(7).fillColor('#000000').text('WWW.GOPHONE.PE', { align: 'center', width: contentWidth });

        doc.end();
    });
};