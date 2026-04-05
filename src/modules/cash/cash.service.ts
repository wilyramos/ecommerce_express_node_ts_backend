import { Sale } from '../../models/Sale';
import { CashShift, CashMovement } from './cash.model';

export class CashService {
  async getActiveShift() {
    return await CashShift.findOne({ status: 'OPEN' }).populate('openedBy', 'nombre');
  }

  async openShift(userId: string, initialBalance: number) {
    const existing = await this.getActiveShift();
    if (existing) throw new Error("A cash shift is already open.");

    return await CashShift.create({
      openedBy: userId,
      initialBalance,
      expectedBalance: initialBalance
    });
  }

  async addMovement(shiftId: string, type: 'INCOME' | 'EXPENSE', amount: number, reason: string) {
    const shift = await CashShift.findById(shiftId);
    if (!shift || shift.status === 'CLOSED') throw new Error("Shift not found or already closed.");

    await CashMovement.create({ shiftId, type, amount, reason });

    if (type === 'INCOME') shift.totalIncomes += amount;
    else shift.totalExpenses += amount;

    shift.expectedBalance = shift.initialBalance + shift.totalSalesCash + shift.totalIncomes - shift.totalExpenses;
    return await shift.save();
  }

  async updateCashFromSale(amount: number) {
    const shift = await this.getActiveShift();
    if (!shift) return; // Silent return if no cash control is active

    shift.totalSalesCash += amount;
    shift.expectedBalance += amount;
    await shift.save();
  }

  async closeShift(shiftId: string, realBalance: number, userId: string, notes?: string) {
    const shift = await CashShift.findById(shiftId);
    if (!shift || shift.status === 'CLOSED') throw new Error("Shift is already closed.");

    shift.realBalance = realBalance;
    shift.difference = realBalance - shift.expectedBalance;
    shift.status = 'CLOSED';
    shift.closedBy = userId as any;
    shift.closingDate = new Date();
    shift.notes = notes;

    return await shift.save();
  }

  async getClosingSummary(shiftId: string) {
    const shift = await CashShift.findById(shiftId);
    if (!shift) throw new Error("Turno de caja no encontrado.");

    // Obtenemos todas las ventas vinculadas a este ID de turno
    const sales = await Sale.find({ cashShiftId: shiftId });

    // Inicializamos el contador
    const summary = {
      CASH: 0,
      CARD: 0,
      YAPE: 0,
      PLIN: 0,
      TRANSFER: 0,
      total: 0,
      count: sales.length
    };

    // Sumamos los totales por cada método de pago
    sales.forEach(sale => {
      const method = sale.paymentMethod as keyof typeof summary;
      if (summary[method] !== undefined) {
        summary[method] += sale.totalPrice;
      }
      summary.total += sale.totalPrice;
    });

    return summary;
  }
}