//File: backend/src/utils/date-helper.ts

export function getPeruDateRange(from?: string, to?: string) {
    const range: { $gte?: Date; $lte?: Date } = {};

    if (from) {
        // Fuerza el inicio del día en hora de Perú (00:00:00.000 -05:00)
        range.$gte = new Date(`${from}T00:00:00.000-05:00`);
    }

    if (to) {
        // Fuerza el cierre del día en hora de Perú (23:59:59.999 -05:00)
        range.$lte = new Date(`${to}T23:59:59.999-05:00`);
    }

    return range;
}