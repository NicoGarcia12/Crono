import {
  buildMonthGrid,
  buildWeek,
  eventsByDay,
  periodLabel,
  shiftMonth,
  shiftWeek,
  startOfWeek,
} from '@/utils/calendar';
import { dateToIso } from '@/utils/dates';
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

  it('junta varios eventos en el mismo día', () => {
    const uno = evento({ id: 5, date: '2026-07-20' });
    const dos = evento({ id: 6, type: 'cita_medica', date: '2026-07-20' });

    expect(eventsByDay([uno, dos], days).get('2026-07-20')).toEqual([uno, dos]);
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
