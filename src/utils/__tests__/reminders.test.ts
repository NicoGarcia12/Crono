import { formatReminder, reminderDate, reminderRank, sameReminder } from '@/utils/reminders';
import { dateToIso } from '@/utils/dates';

describe('reminderDate', () => {
  const evento = new Date(2026, 11, 20, 10, 0); // 20 de diciembre de 2026, 10:00

  it('resta minutos, horas, días y semanas', () => {
    expect(reminderDate(evento, { amount: 30, unit: 'minutos' })).toEqual(new Date(2026, 11, 20, 9, 30));
    expect(reminderDate(evento, { amount: 2, unit: 'horas' })).toEqual(new Date(2026, 11, 20, 8, 0));
    expect(reminderDate(evento, { amount: 1, unit: 'dias' })).toEqual(new Date(2026, 11, 19, 10, 0));
    expect(reminderDate(evento, { amount: 1, unit: 'semanas' })).toEqual(new Date(2026, 11, 13, 10, 0));
  });

  it('con amount 0 avisa en el momento del evento', () => {
    expect(reminderDate(evento, { amount: 0, unit: 'minutos' })).toEqual(evento);
  });

  it('resta meses por calendario: mismo número de día, mes anterior', () => {
    expect(dateToIso(reminderDate(evento, { amount: 1, unit: 'meses' }))).toBe('2026-11-20');
    expect(dateToIso(reminderDate(evento, { amount: 3, unit: 'meses' }))).toBe('2026-09-20');
  });

  it('cruza el año hacia atrás si hace falta', () => {
    const enero = new Date(2027, 0, 15, 9, 0);
    expect(dateToIso(reminderDate(enero, { amount: 2, unit: 'meses' }))).toBe('2026-11-15');
  });

  // El caso fino: días 29, 30 y 31 en meses que no los tienen.
  it('recorta al último día del mes cuando el día no existe', () => {
    // 31 de marzo menos 1 mes → febrero no tiene 31: avisa el 28 (2026 no es bisiesto).
    const marzo31 = new Date(2026, 2, 31, 9, 0);
    expect(dateToIso(reminderDate(marzo31, { amount: 1, unit: 'meses' }))).toBe('2026-02-28');

    // Mismo caso en año bisiesto: avisa el 29.
    const marzo31Bisiesto = new Date(2028, 2, 31, 9, 0);
    expect(dateToIso(reminderDate(marzo31Bisiesto, { amount: 1, unit: 'meses' }))).toBe('2028-02-29');

    // 30 de marzo menos 1 mes → febrero tampoco tiene 30: avisa el 28.
    const marzo30 = new Date(2026, 2, 30, 9, 0);
    expect(dateToIso(reminderDate(marzo30, { amount: 1, unit: 'meses' }))).toBe('2026-02-28');

    // 31 de mayo menos 1 mes → abril tiene 30 días: avisa el 30.
    const mayo31 = new Date(2026, 4, 31, 9, 0);
    expect(dateToIso(reminderDate(mayo31, { amount: 1, unit: 'meses' }))).toBe('2026-04-30');
  });

  it('conserva la hora del evento al restar meses', () => {
    const result = reminderDate(new Date(2026, 2, 31, 18, 45), { amount: 1, unit: 'meses' });
    expect(result.getHours()).toBe(18);
    expect(result.getMinutes()).toBe(45);
  });
});

describe('formatReminder', () => {
  it('usa singular, plural y el caso especial de amount 0', () => {
    expect(formatReminder({ amount: 0, unit: 'minutos' })).toBe('En el momento');
    expect(formatReminder({ amount: 1, unit: 'dias' })).toBe('1 día antes');
    expect(formatReminder({ amount: 3, unit: 'dias' })).toBe('3 días antes');
    expect(formatReminder({ amount: 1, unit: 'meses' })).toBe('1 mes antes');
    expect(formatReminder({ amount: 2, unit: 'meses' })).toBe('2 meses antes');
  });
});

describe('reminderRank', () => {
  it('ordena de la anticipación más lejana a la más cercana', () => {
    const avisos = [
      { amount: 1, unit: 'horas' as const },
      { amount: 1, unit: 'meses' as const },
      { amount: 1, unit: 'dias' as const },
      { amount: 1, unit: 'semanas' as const },
    ];

    const ordenados = [...avisos].sort((a, b) => reminderRank(b) - reminderRank(a));

    expect(ordenados.map((r) => r.unit)).toEqual(['meses', 'semanas', 'dias', 'horas']);
  });
});

describe('sameReminder', () => {
  it('considera igual "en el momento" sin importar la unidad', () => {
    expect(sameReminder({ amount: 0, unit: 'minutos' }, { amount: 0, unit: 'dias' })).toBe(true);
  });

  it('distingue cantidad y unidad', () => {
    expect(sameReminder({ amount: 1, unit: 'dias' }, { amount: 1, unit: 'dias' })).toBe(true);
    expect(sameReminder({ amount: 1, unit: 'dias' }, { amount: 1, unit: 'semanas' })).toBe(false);
    expect(sameReminder({ amount: 1, unit: 'dias' }, { amount: 2, unit: 'dias' })).toBe(false);
  });
});
