import {
  capitalize,
  dateToIso,
  dateToTime,
  formatLongDate,
  formatRelative,
  nextOccurrence,
  toLocalDate,
  yearsSince,
} from '@/utils/dates';

/**
 * 💡 Aprendizaje: estas funciones son "puras" (mismo input → mismo output,
 * sin tocar BD ni red), por eso son lo más fácil y valioso de testear primero.
 * Donde la fecha "actual" importa, se pasa `from` explícito — nunca depender
 * del reloj real en un test.
 */

describe('toLocalDate', () => {
  it('interpreta la fecha ISO en hora local', () => {
    const d = toLocalDate('2026-07-14');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6); // julio (los meses de Date van de 0 a 11)
    expect(d.getDate()).toBe(14);
    expect(d.getHours()).toBe(0);
  });

  it('acepta hora opcional HH:mm', () => {
    const d = toLocalDate('2026-07-14', '18:30');
    expect(d.getHours()).toBe(18);
    expect(d.getMinutes()).toBe(30);
  });
});

describe('dateToIso / dateToTime', () => {
  it('formatea con ceros a la izquierda', () => {
    const d = new Date(2026, 0, 5, 9, 7);
    expect(dateToIso(d)).toBe('2026-01-05');
    expect(dateToTime(d)).toBe('09:07');
  });

  it('es inversa de toLocalDate', () => {
    expect(dateToIso(toLocalDate('2026-12-31'))).toBe('2026-12-31');
  });
});

describe('nextOccurrence', () => {
  const from = new Date(2026, 6, 11, 12, 0); // 11 de julio de 2026, mediodía

  it('evento puntual: devuelve su propia fecha aunque ya haya pasado', () => {
    const past = nextOccurrence({ date: '2026-03-01', time: null, yearly: 0 }, from);
    expect(dateToIso(past)).toBe('2026-03-01');
  });

  it('evento anual que todavía no pasó este año: cae este año', () => {
    const next = nextOccurrence({ date: '1990-12-20', time: null, yearly: 1 }, from);
    expect(dateToIso(next)).toBe('2026-12-20');
  });

  it('evento anual que ya pasó este año: rota al año siguiente', () => {
    const next = nextOccurrence({ date: '1990-03-05', time: null, yearly: 1 }, from);
    expect(dateToIso(next)).toBe('2027-03-05');
  });

  it('evento anual de HOY con hora futura: cae hoy', () => {
    const next = nextOccurrence({ date: '1990-07-11', time: '20:00', yearly: 1 }, from);
    expect(dateToIso(next)).toBe('2026-07-11');
  });
});

describe('formatLongDate', () => {
  it('formatea en español con día de la semana', () => {
    expect(formatLongDate('2026-07-14')).toBe('martes 14 de julio de 2026');
  });
});

describe('formatRelative', () => {
  const from = new Date(2026, 6, 11, 23, 59); // 11 de julio de 2026

  it('reconoce Hoy, Mañana y Ayer sin importar la hora', () => {
    expect(formatRelative(new Date(2026, 6, 11, 0, 0), from)).toBe('Hoy');
    expect(formatRelative(new Date(2026, 6, 12), from)).toBe('Mañana');
    expect(formatRelative(new Date(2026, 6, 10), from)).toBe('Ayer');
  });

  it('usa formato corto dentro del mismo año', () => {
    expect(formatRelative(new Date(2026, 11, 20), from)).toBe('20 dic');
  });

  it('agrega el año cuando es distinto', () => {
    expect(formatRelative(new Date(2027, 2, 5), from)).toBe('5 mar 2027');
  });

  it('marca fechas pasadas del mismo año', () => {
    expect(formatRelative(new Date(2026, 2, 5), from)).toBe('5 mar (pasado)');
  });
});

describe('capitalize', () => {
  it('pone en mayúscula SOLO la primera letra', () => {
    // El textTransform: 'capitalize' de CSS haría 'Domingo 20 De Diciembre De 2026'.
    expect(capitalize('domingo 20 de diciembre de 2026')).toBe('Domingo 20 de diciembre de 2026');
    expect(capitalize('julio 2026')).toBe('Julio 2026');
  });
});

describe('yearsSince', () => {
  it('calcula la edad que se cumple en la ocurrencia', () => {
    expect(yearsSince('1990-12-20', new Date(2026, 11, 20))).toBe(36);
  });
});
