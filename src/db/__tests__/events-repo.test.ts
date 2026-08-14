import { attachReminders } from '@/db/events-repo';

// El repo importa la conexión SQLite (nativa); acá solo se testea la
// función pura de agrupado, así que alcanza con mockear el módulo de BD.
jest.mock('@/db/database', () => ({ getDb: jest.fn() }));

describe('attachReminders', () => {
  const events = [
    { id: 1, title: 'Mamá', type: 'cumpleanos' as const, date: '1960-08-01', time: null, description: null, yearly: 1 as const },
    { id: 2, title: 'Turno médico', type: 'cita_medica' as const, date: '2026-09-10', time: '10:30', description: null, yearly: 0 as const },
  ];

  it('agrupa los avisos por evento (relación 1→N)', () => {
    const reminders = [
      { eventId: 1, amount: 1, unit: 'meses' as const, notificationId: 'n1' },
      { eventId: 1, amount: 1, unit: 'semanas' as const, notificationId: 'n2' },
    ];

    const result = attachReminders(events, reminders);

    expect(result[0].reminders).toEqual([
      { amount: 1, unit: 'meses', notificationId: 'n1' },
      { amount: 1, unit: 'semanas', notificationId: 'n2' },
    ]);
    expect(result[1].reminders).toEqual([]); // sin avisos → lista vacía, nunca undefined
  });

  it('ignora avisos de eventos que no están en la lista', () => {
    const result = attachReminders(events, [
      { eventId: 99, amount: 1, unit: 'horas', notificationId: null },
    ]);

    expect(result.every((e) => e.reminders.length === 0)).toBe(true);
  });
});
