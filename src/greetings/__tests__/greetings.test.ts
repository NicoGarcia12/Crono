import { buildGreetingRows, greetingsSummary } from '@/greetings/greetings';
import type { EventItem, Greeting } from '@/types';

const evento = (over: Partial<EventItem> & { id: number }): EventItem => ({
  title: 'Ana',
  type: 'cumpleanos',
  date: '1995-12-20',
  time: null,
  description: null,
  contactId: null,
  phone: null,
  reminders: [],
  yearly: 1,
  isMine: 0,
  tags: [],
  ...over,
});

const saludo = (over: Partial<Greeting> & { id: number }): Greeting => ({
  year: 2026,
  eventId: null,
  name: 'Invitado',
  phone: null,
  greeted: 0,
  ...over,
});

describe('buildGreetingRows', () => {
  const events = [
    evento({ id: 1, title: 'Ana' }),
    evento({ id: 2, title: 'Bruno', phone: '+54 11 5555-0002' }),
    evento({ id: 3, title: 'Yo', isMine: 1 }), // mi cumpleaños no va en la lista
    evento({ id: 4, title: 'Turno médico', type: 'cita_medica' }), // no es cumpleaños
  ];

  it('lista los cumpleaños de la agenda menos el mío, ordenados', () => {
    const rows = buildGreetingRows(events, []);

    expect(rows.map((r) => r.name)).toEqual(['Ana', 'Bruno']);
    expect(rows[0]).toMatchObject({ key: 'evento:1', greeted: false, isGuest: false, greetingId: null });
    expect(rows[1].phone).toBe('+54 11 5555-0002');
  });

  it('refleja quién saludó ese año', () => {
    const rows = buildGreetingRows(events, [saludo({ id: 10, eventId: 2, name: 'Bruno', greeted: 1 })]);

    expect(rows.find((r) => r.name === 'Bruno')).toMatchObject({ greeted: true, greetingId: 10 });
    expect(rows.find((r) => r.name === 'Ana')?.greeted).toBe(false);
  });

  it('suma a los anotados a mano, marcados como invitados', () => {
    const rows = buildGreetingRows(events, [saludo({ id: 11, name: 'Carla', greeted: 1 })]);

    expect(rows.map((r) => r.name)).toEqual(['Ana', 'Bruno', 'Carla']);
    expect(rows.find((r) => r.name === 'Carla')).toMatchObject({
      key: 'invitado:11',
      isGuest: true,
      greeted: true,
      eventId: null,
    });
  });

  it('cuando a un invitado se le carga el cumpleaños, no aparece duplicado', () => {
    // La fila del saludo ahora apunta al evento nuevo (id 5).
    const conCumple = [...events, evento({ id: 5, title: 'Carla' })];
    const rows = buildGreetingRows(conCumple, [saludo({ id: 11, eventId: 5, name: 'Carla', greeted: 1 })]);

    const carlas = rows.filter((r) => r.name === 'Carla');
    expect(carlas).toHaveLength(1);
    expect(carlas[0]).toMatchObject({ isGuest: false, greeted: true, eventId: 5 });
  });
});

describe('greetingsSummary', () => {
  it('cuenta cuántos saludaron sobre el total', () => {
    const rows = buildGreetingRows(
      [evento({ id: 1, title: 'Ana' }), evento({ id: 2, title: 'Bruno' })],
      [saludo({ id: 10, eventId: 2, name: 'Bruno', greeted: 1 })],
    );

    expect(greetingsSummary(rows)).toEqual({ greeted: 1, total: 2 });
  });
});
