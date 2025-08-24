// FILE: backend/src/utils/generateTicket.ts
import PDFKit from "pdfkit";
// import { Sale } from "../types/sale";

const drawCommon = (doc: PDFKit.PDFDocument, sale: any) => {
    sale.items.forEach((item: any) => {
        doc.text(
            `${item.product.nombre} x${item.quantity} - S/ ${(item.price * item.quantity).toFixed(2)}`
        );
    });
    doc.moveDown();
    doc.text(`TOTAL: S/ ${sale.totalPrice.toFixed(2)}`, { align: "right" });
    doc.moveDown();
    doc.text("¡Gracias por su compra!", { align: "center" });
};

export const generateTicketPDF = (doc: PDFKit.PDFDocument, sale: any) => {
    doc.fontSize(12).text("TICKET DE VENTA", { align: "center" });
    doc.moveDown();
    drawCommon(doc, sale);
};

export const generateBoletaPDF = (doc: PDFKit.PDFDocument, sale: any) => {
    doc.fontSize(12).text("BOLETA DE VENTA", { align: "center" });
    doc.moveDown();

    if (sale.customerSnapshot?.dni) {
        doc.text(`DNI: ${sale.customerSnapshot.dni}`);
        doc.text(`Cliente: ${sale.customerSnapshot.nombre || "-"}`);
        doc.moveDown();
    }

    drawCommon(doc, sale);
};

export const generateFacturaPDF = (doc: PDFKit.PDFDocument, sale: any) => {
    doc.fontSize(12).text("FACTURA DE VENTA", { align: "center" });
    doc.moveDown();

    if (sale.customerSnapshot?.ruc) {
        doc.text(`RUC: ${sale.customerSnapshot.ruc}`);
        doc.text(`Razón Social: ${sale.customerSnapshot.nombre || "-"}`);
        doc.text(`Dirección: ${sale.customerSnapshot.direccion || "-"}`);
        doc.moveDown();
    }

    drawCommon(doc, sale);
};
