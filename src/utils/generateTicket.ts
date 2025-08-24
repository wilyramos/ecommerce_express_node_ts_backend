import PDFDocument from "pdfkit";
import { ISale } from "../models/Sale";

// Datos de tu empresa (puedes traerlo de BD o config)
const COMPANY_INFO = {
    nombre: "Mi Empresa SAC",
    ruc: "20123456789",
    direccion: "Av. Ejemplo 123 - Lima, Perú",
    telefono: "(01) 456-7890",
};

// === HELPERS ===
const formatCurrency = (value: number) => `S/ ${value.toFixed(2)}`;

// === PARTES DEL DOCUMENTO ===
const drawHeader = (doc: PDFKit.PDFDocument, sale: ISale) => {
    doc.fontSize(14).text(COMPANY_INFO.nombre, { align: "center" });
    doc.fontSize(10).text(`RUC: ${COMPANY_INFO.ruc}`, { align: "center" });
    doc.text(COMPANY_INFO.direccion, { align: "center" });
    doc.text(`Tel: ${COMPANY_INFO.telefono}`, { align: "center" });
    doc.moveDown();

    doc.fontSize(12).text(`${sale.receiptType || "COMPROBANTE"} DE VENTA`, {
        align: "center",
        underline: true,
    });
    if (sale.receiptNumber) {
        doc.text(`N° ${sale.receiptNumber}`, { align: "center" });
    }
    doc.moveDown();

    doc.fontSize(10).text(`Fecha: ${new Date(sale.createdAt).toLocaleString()}`);
    doc.text(`Método de Pago: ${sale.paymentMethod}`);
    doc.moveDown();
};

const drawCustomer = (doc: PDFKit.PDFDocument, sale: ISale) => {
    const c = sale.customerSnapshot;
    if (!c) return;

    doc.fontSize(10).text("DATOS DEL CLIENTE", { underline: true });
    if (c.tipoDocumento && c.numeroDocumento) {
        doc.text(`${c.tipoDocumento}: ${c.numeroDocumento}`);
    }
    if (c.nombre) doc.text(`Nombre/Razón Social: ${c.nombre}`);
    if (c.direccion) doc.text(`Dirección: ${c.direccion}`);
    if (c.telefono) doc.text(`Tel: ${c.telefono}`);
    if (c.email) doc.text(`Email: ${c.email}`);
    doc.moveDown();
};

const drawItemsTable = (doc: PDFKit.PDFDocument, sale: ISale) => {
    doc.fontSize(10).text("DETALLE DE PRODUCTOS", { underline: true });
    const tableTop = doc.y + 5;

    // Encabezados
    doc.text("Cant.", 50, tableTop);
    doc.text("Descripción", 100, tableTop);
    doc.text("P. Unit", 300, tableTop);
    doc.text("Importe", 400, tableTop);

    let y = tableTop + 15;
    sale.items.forEach((item) => {
        const importe = item.price * item.quantity;
        doc.text(item.quantity.toString(), 50, y);
        // ⚠️ Ojo: si item.product es un ObjectId tendrás que "populate" para tener el nombre
        const nombre =
            typeof item.product === "object" && "nombre" in item.product
                ? item.product.nombre
                : "Producto";
        doc.text(nombre, 100, y, { width: 180 });
        doc.text(formatCurrency(item.price), 300, y);
        doc.text(formatCurrency(importe), 400, y);
        y += 20;
    });

    doc.moveDown();
};

const drawTotals = (doc: PDFKit.PDFDocument, sale: ISale) => {
    const subtotal = sale.totalPrice / 1.18;
    const igv = sale.totalPrice - subtotal;
    const descuento = sale.totalDiscountAmount || 0;

    const startY = doc.y + 10;
    doc.fontSize(10);
    if (descuento > 0) {
        doc.text(`Descuento: ${formatCurrency(descuento)}`, 350, startY, {
            align: "right",
        });
    }
    doc.text(`Sub Total: ${formatCurrency(subtotal)}`, 350, startY + 15, {
        align: "right",
    });
    doc.text(`IGV (18%): ${formatCurrency(igv)}`, 350, startY + 30, {
        align: "right",
    });
    doc.font("Helvetica-Bold").text(
        `TOTAL: ${formatCurrency(sale.totalPrice)}`,
        350,
        startY + 45,
        { align: "right" }
    );
    doc.font("Helvetica").moveDown();
};

const drawFooter = (doc: PDFKit.PDFDocument) => {
    doc.moveDown();
    doc.fontSize(9).text("Representación impresa de comprobante electrónico", {
        align: "center",
    });
    doc.text("Gracias por su compra", { align: "center" });
};

// === EXPORTADOS ===
export const generateSalePDF = (doc: PDFKit.PDFDocument, sale: ISale) => {
    drawHeader(doc, sale);
    drawCustomer(doc, sale);
    drawItemsTable(doc, sale);
    drawTotals(doc, sale);
    drawFooter(doc);
};
