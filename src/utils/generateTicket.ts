import { ISale } from "../models/Sale";

// Datos de la empresa (pueden venir de BD o config)
const COMPANY = {
    nombre: "GOPHONE",
    ruc: "1072516715",
    direccion: "Jr. Bernardo Ohggins 120 - San Vicente de Cañete, Lima - Perú",
    telefono: "907103353",
};

// Colores modernos
const COLORS = {
    primary: "#333",
    secondary: "#666",
    accent: "#007bff",
};

// Helper
const formatCurrency = (value: number) => `S/ ${value.toFixed(2)}`;

// === GENERAR PDF ===
export const generateSalePDF = (doc: PDFKit.PDFDocument, sale: ISale) => {
    doc.fontSize(16).font("Helvetica-Bold").fillColor(COLORS.primary).text(COMPANY.nombre, { align: "center" });
    doc.fontSize(10).font("Helvetica").fillColor(COLORS.secondary)
       .text(`RUC: ${COMPANY.ruc}`, { align: "center" })
       .text(COMPANY.direccion, { align: "center" })
       .text(`Tel: ${COMPANY.telefono}`, { align: "center" })
       .moveDown();

    doc.fontSize(12).font("Helvetica-Bold").fillColor(COLORS.primary)
       .text(`${sale.receiptType || "COMPROBANTE"} DE VENTA`, { align: "center" });
    if (sale.receiptNumber) doc.fontSize(10).text(`N° ${sale.receiptNumber}`, { align: "center" });
    
    doc.moveDown(0.5).strokeColor(COLORS.accent).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    // --- Cliente ---
    const c = sale.customerSnapshot;
    if (c) {
        doc.fontSize(10).fillColor(COLORS.primary).text("DATOS DEL CLIENTE", { underline: true });
        doc.moveDown(0.2);
        if (c.tipoDocumento && c.numeroDocumento) doc.text(`${c.tipoDocumento}: ${c.numeroDocumento}`);
        if (c.nombre) doc.text(`Nombre/Razón Social: ${c.nombre}`);
        if (c.direccion) doc.text(`Dirección: ${c.direccion}`);
        if (c.telefono) doc.text(`Teléfono: ${c.telefono}`);
        if (c.email) doc.text(`Email: ${c.email}`);
        doc.moveDown();
    }

    // --- Detalle de productos ---
    doc.fontSize(10).fillColor(COLORS.primary).text("DETALLE DE PRODUCTOS", { underline: true });
    const tableTop = doc.y + 5;
    const itemX = 50, descX = 120, priceX = 350, totalX = 450;

    doc.font("Helvetica-Bold").text("Cant.", itemX, tableTop)
       .text("Descripción", descX, tableTop)
       .text("P. Unit", priceX, tableTop, { align: "right", width: 80 })
       .text("Importe", totalX, tableTop, { align: "right", width: 80 });

    doc.strokeColor(COLORS.secondary).moveTo(itemX, tableTop + 15).lineTo(550, tableTop + 15).stroke();
    doc.font("Helvetica");

    let y = tableTop + 25;
    sale.items.forEach(item => {
        const importe = item.price * item.quantity;
        const nombre = typeof item.product === "object" && "nombre" in item.product ? item.product.nombre : "Producto";
        doc.text(item.quantity.toString(), itemX, y);
        doc.text(nombre, descX, y, { width: 220 });
        doc.text(formatCurrency(item.price), priceX, y, { align: "right", width: 80 });
        doc.text(formatCurrency(importe), totalX, y, { align: "right", width: 80 });
        y += 20;
    });
    doc.strokeColor(COLORS.secondary).moveTo(itemX, y - 5).lineTo(550, y - 5).stroke();
    doc.moveDown();

    // --- Totales ---
    const subtotal = sale.totalPrice / 1.18;
    const igv = sale.totalPrice - subtotal;
    const descuento = sale.totalDiscountAmount || 0;
    const startY = doc.y + 10;

    doc.fontSize(10).fillColor(COLORS.secondary);
    if (descuento > 0) {
        doc.text(`Descuento:`, totalX - 100, startY, { continued: true }).text(formatCurrency(descuento), { align: "right" });
    }
    doc.text(`Sub Total:`, totalX - 100, startY + 15, { continued: true }).text(formatCurrency(subtotal), { align: "right" });
    doc.text(`IGV (18%):`, totalX - 100, startY + 30, { continued: true }).text(formatCurrency(igv), { align: "right" });
    doc.font("Helvetica-Bold").fontSize(12)
       .text(`TOTAL:`, totalX - 100, startY + 45, { continued: true })
       .text(formatCurrency(sale.totalPrice), { align: "right" });
    
    doc.font("Helvetica").moveDown(2);
    doc.text(`Método de Pago: ${sale.paymentMethod}`);
    
    // --- Footer ---
    doc.moveDown();
    doc.strokeColor(COLORS.accent).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();
    doc.fontSize(9).fillColor(COLORS.secondary)
       .text("Representación impresa de comprobante electrónico", { align: "center" })
       .text("¡Gracias por su compra!", { align: "center" });
};
