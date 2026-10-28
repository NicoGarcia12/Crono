import {
  buildMonthGrid,
  buildWeek,
  eventsByDay,
  greetableInMonth,
  periodLabel,
  shiftMonth,
  shiftWeek,
  startOfWeek,
} from '@/utils/calendar';
import { defaultHasCapability } from '@/test-utils';
import { countdownLabel, dateToIso, dateToTime, formatRelative, nextOccurrence, toLocalDate } from '@/utils/dates';
import { reminderDate } from '@/utils/reminders';
import type { EventItem } from '@/types';

const evento = (over: Partial<EventItem> & { id: number }): EventItem => ({
  title: 'Evento',
  type: 'evento',
  date: '2026-07-15',
  time: null,
  description: null,
  contactId: null,
  phone: null,
  reminders: [],
  yearly: 0,
  isMine: 0,
  tags: [],
  photoUri: null,
  yearUnknown: 0,
  ...over,
});

describe('startOfWeek', () => {
  it('devuelve el lunes de esa semana', () => {
    // 15 de julio de 2026 es miércoles → lunes 13.
    expect(dateToIso(startOfWeek(new Date(2026, 6, 15)))).toBe('2026-07-13');
  });

  it('un domingo pertenece a la semana que arrancó el lunes anterior', () => {
    // 19 de julio de 2026 es domingo → lunes 13.
    expect(dateToIso(startOfWeek(new Date(2026, 6, 19)))).toBe('2026-07-13');
  });
});

describe('buildWeek', () => {
  it('arma 7 días de lunes a domingo', () => {
    const week = buildWeek(new Date(2026, 6, 15)).map(dateToIso);

    expect(week).toEqual([
      '2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16',
      '2026-07-17', '2026-07-18', '2026-07-19',
    ]);
  });
});

describe('buildMonthGrid', () => {
  it('cubre el mes completo con semanas enteras, incluyendo días de los meses vecinos', () => {
    const weeks = buildMonthGrid(new Date(2026, 6, 1)); // julio 2026 (arranca miércoles)
    const days = weeks.flat().map(dateToIso);

    expect(weeks.every((w) => w.length === 7)).toBe(true);
    // La grilla empieza el lunes anterior al 1 de julio (29 de junio)…
    expect(days[0]).toBe('2026-06-29');
    // …y termina el domingo posterior al 31 de julio (2 de agosto).
    expect(days[days.length - 1]).toBe('2026-08-02');
    // Todos los días de julio están.
    expect(days).toContain('2026-07-01');
    expect(days).toContain('2026-07-31');
  });

  it('funciona con un mes que arranca lunes (sin días de relleno al principio)', () => {
    const days = buildMonthGrid(new Date(2026, 5, 1)).flat().map(dateToIso); // junio 2026 arranca lunes
    expect(days[0]).toBe('2026-06-01');
  });
});

describe('shiftMonth / shiftWeek', () => {
  it('navega meses hacia adelante y atrás, cruzando el año', () => {
    expect(dateToIso(shiftMonth(new Date(2026, 11, 10), 1))).toBe('2027-01-01');
    expect(dateToIso(shiftMonth(new Date(2026, 0, 10), -1))).toBe('2025-12-01');
  });

  it('navega semanas hacia adelante y atrás', () => {
    expect(dateToIso(shiftWeek(new Date(2026, 6, 15), 1))).toBe('2026-07-22');
    expect(dateToIso(shiftWeek(new Date(2026, 6, 15), -1))).toBe('2026-07-08');
  });
});

describe('eventsByDay', () => {
  const days = buildMonthGrid(new Date(2026, 6, 1)).flat(); // julio 2026

  it('ubica un evento puntual en su fecha', () => {
    const cena = evento({ id: 1, date: '2026-07-15' });

    const byDay = eventsByDay([cena], days);

    expect(byDay.get('2026-07-15')).toEqual([cena]);
    expect(byDay.get('2026-07-16')).toBeUndefined();
  });

  it('no muestra un evento puntual de otro año', () => {
    const viejo = evento({ id: 2, date: '2025-07-15' });

    expect(eventsByDay([viejo], days).size).toBe(0);
  });

  it('repite los eventos anuales en el año que se está mirando', () => {
    // Cumpleaños guardado en 1990: tiene que aparecer el 15 de julio de 2026.
    const cumple = evento({ id: 3, type: 'cumpleanos', date: '1990-07-15', yearly: 1 });

    const byDay = eventsByDay([cumple], days);

    expect(byDay.get('2026-07-15')).toEqual([cumple]);
  });

  it('mantiene el 29 de febrero para un anual durante un año bisiesto', () => {
    const february2024 = buildMonthGrid(new Date(2024, 1, 1)).flat();
    const cumpleBisiesto = evento({ id: 30, type: 'cumpleanos', date: '2000-02-29', yearly: 1 });

    expect(eventsByDay([cumpleBisiesto], february2024).get('2024-02-29')).toEqual([cumpleBisiesto]);
  });

  it('muestra un anual del 29 de febrero el 28 de febrero en un año no bisiesto', () => {
    const february2026 = buildMonthGrid(new Date(2026, 1, 1)).flat();
    const cumpleBisiesto = evento({ id: 31, type: 'cumpleanos', date: '2000-02-29', yearly: 1 });

    expect(eventsByDay([cumpleBisiesto], february2026).get('2026-02-28')).toEqual([cumpleBisiesto]);
  });

  it('en una grilla que cruza el año, ubica el anual en el año que corresponde a cada día', () => {
    // La grilla de diciembre de 2026 termina el domingo 3 de enero de 2027.
    const diciembre2026 = buildMonthGrid(new Date(2026, 11, 1)).flat();
    const anioNuevo = evento({ id: 4, type: 'festivo', date: '2000-01-01', yearly: 1 });

    const byDay = eventsByDay([anioNuevo], diciembre2026);

    // Los días de enero visibles son los de 2027: ahí cae el feriado, y no en 2026.
    expect(byDay.get('2027-01-01')).toEqual([anioNuevo]);
    expect(byDay.get('2026-01-01')).toBeUndefined();
  });

  it.each([
    { from: '2027-02-27', next: '2027-02-28', label: 'Falta 1 día', relative: 'Mañana', reminder: '2027-02-27' },
    { from: '2027-02-28', next: '2027-02-28', label: 'Es hoy', relative: 'Hoy', reminder: '2027-02-27' },
    { from: '2027-03-01', next: '2028-02-29', label: 'Faltan 365 días', relative: '29 feb 2028', reminder: '2028-02-28' },
    { from: '2027-12-31', next: '2028-02-29', label: 'Faltan 60 días', relative: '29 feb 2028', reminder: '2028-02-28' },
    { from: '2028-01-01', next: '2028-02-29', label: 'Faltan 59 días', relative: '29 feb', reminder: '2028-02-28' },
    { from: '2028-02-28', next: '2028-02-29', label: 'Falta 1 día', relative: 'Mañana', reminder: '2028-02-28' },
    { from: '2028-02-29', next: '2028-02-29', label: 'Es hoy', relative: 'Hoy', reminder: '2028-02-28' },
    { from: '2028-03-01', next: '2029-02-28', label: 'Faltan 364 días', relative: '28 feb 2029', reminder: '2029-02-27' },
  ])('agenda, calendario, countdown y fecha del aviso coinciden desde $from', ({ from, next, label, relative, reminder }) => {
    const original = Object.freeze(evento({ id: 38, date: '2000-02-29', yearly: 1, time: '10:00' }));
    const now = toLocalDate(from, '09:00');
    const occurrence = nextOccurrence(original, now);
    const month = buildMonthGrid(toLocalDate(next)).flat();
    const byDay = eventsByDay([original], month);

    expect(dateToIso(occurrence)).toBe(next);
    expect([...byDay.keys()]).toEqual([next]);
    expect(byDay.get(next)).toEqual([original]);
    expect(formatRelative(occurrence, now)).toBe(relative);
    expect(countdownLabel(occurrence, now)).toBe(label);
    const reminderAt = reminderDate(occurrence, { amount: 1, unit: 'dias' });
    expect(dateToIso(reminderAt)).toBe(reminder);
    expect(dateToTime(reminderAt)).toBe('10:00');
    expect(original.date).toBe('2000-02-29');
  });

  it('proyectar años no bisiestos no cambia la identidad del 29/2 al volver a un bisiesto', () => {
    const original = Object.freeze(evento({ id: 38, date: '2000-02-29', yearly: 1 }));

    for (const year of [2027, 2028, 2029, 2032, 2028]) {
      const byDay = eventsByDay([original], buildMonthGrid(new Date(year, 1, 1)).flat());
      expect([...byDay.keys()]).toEqual([`${year}-02-${year === 2028 || year === 2032 ? '29' : '28'}`]);
      expect(original.date).toBe('2000-02-29');
    }
  });

  it('junta varios eventos en el mismo día', () => {
    const uno = evento({ id: 5, date: '2026-07-20' });
    const dos = evento({ id: 6, type: 'cita_medica', date: '2026-07-20' });

    expect(eventsByDay([uno, dos], days).get('2026-07-20')).toEqual([uno, dos]);
  });
});

describe('greetableInMonth', () => {
  const julio2026 = new Date(2026, 6, 1);

  it('incluye un cumpleaños anual que cae en el mes, sin importar el año guardado', () => {
    const mama = evento({ id: 1, type: 'cumpleanos', date: '1965-07-20', yearly: 1 });

    expect(greetableInMonth([mama], julio2026, defaultHasCapability)).toEqual([mama]);
  });

  it('excluye mi propio cumpleaños (isMine)', () => {
    const mio = evento({ id: 2, type: 'cumpleanos', date: '1990-07-05', yearly: 1, isMine: 1 });

    expect(greetableInMonth([mio], julio2026, defaultHasCapability)).toEqual([]);
  });

  it('excluye los tipos sin "¿ya lo saludé?", incluidos los aniversarios (son conmemoraciones)', () => {
    const cita = evento({ id: 3, type: 'cita_medica', date: '2026-07-10' });
    const boca = evento({ id: 8, type: 'aniversario', date: '1905-07-03', yearly: 1 });

    expect(greetableInMonth([cita, boca], julio2026, defaultHasCapability)).toEqual([]);
  });

  it('un evento viejo que quedó puntual solo aparece en el año exacto', () => {
    const cumple2026 = evento({ id: 4, type: 'cumpleanos', date: '2026-07-08', yearly: 0 });
    const cumple2025 = evento({ id: 5, type: 'cumpleanos', date: '2025-07-08', yearly: 0 });

    expect(greetableInMonth([cumple2026, cumple2025], julio2026, defaultHasCapability)).toEqual([cumple2026]);
  });

  it('ordena por día del mes', () => {
    const dia20 = evento({ id: 6, type: 'cumpleanos', date: '1980-07-20', yearly: 1 });
    const dia5 = evento({ id: 7, type: 'cumpleanos', date: '1980-07-05', yearly: 1 });

    expect(greetableInMonth([dia20, dia5], julio2026, defaultHasCapability)).toEqual([dia5, dia20]);
  });
});

describe('periodLabel', () => {
  it('en vista mensual muestra mes y año', () => {
    expect(periodLabel(new Date(2026, 6, 15), 'mes')).toBe('julio 2026');
  });

  it('en vista semanal muestra el rango de días', () => {
    expect(periodLabel(new Date(2026, 6, 15), 'semana')).toBe('13 – 19 de julio de 2026');
  });

  it('en una semana a caballo de dos meses, nombra ambos', () => {
    // La semana del 29 de junio al 5 de julio de 2026.
    expect(periodLabel(new Date(2026, 6, 1), 'semana')).toBe('29 de junio – 5 de julio de 2026');
  });
});
