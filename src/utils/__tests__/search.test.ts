import { filterEvents, filterNotes, matches, normalizeText } from '@/utils/search';
import type { EventItem, Note } from '@/types';

const evento = (over: Partial<EventItem> & { id: number }): EventItem => ({
  title: 'Cumple de mamá',
  type: 'cumpleanos',
  date: '1965-07-20',
  time: null,
  description: null,
  contactId: null,
  phone: null,
  reminders: [],
  yearly: 1,
  isMine: 0,
  tags: [],
  photoUri: null,
  ...over,
});

const nota = (over: Partial<Note> & { id: number }): Note => ({
  title: 'Lista del súper',
  content: 'Pan, leche, café',
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-01T10:00:00.000Z',
  ...over,
});

describe('normalizeText', () => {
  it('pasa a minúsculas y saca tildes y la virgulilla de la ñ', () => {
    expect(normalizeText('  Cumple de MAMÁ ')).toBe('cumple de mama');
    // La ñ también se pliega a n: así, buscar 'cumpleanos' encuentra 'cumpleaños'.
    expect(normalizeText('Café con Ñoquis')).toBe('cafe con noquis');
  });
});

describe('matches', () => {
  it('encuentra sin importar tildes ni mayúsculas', () => {
    expect(matches('mama', ['Cumple de mamá'])).toBe(true);
    expect(matches('MAMÁ', ['cumple de mama'])).toBe(true);
  });

  it('exige que TODAS las palabras aparezcan (en cualquier campo)', () => {
    expect(matches('cumple mama', ['Cumple de mamá', null])).toBe(true);
    expect(matches('cumple papa', ['Cumple de mamá', null])).toBe(false);
    expect(matches('turno dentista', ['Turno', 'Ir al dentista'])).toBe(true);
  });

  it('sin búsqueda, entra todo', () => {
    expect(matches('   ', ['lo que sea'])).toBe(true);
  });
});

describe('filterEvents', () => {
  const events = [
    evento({ id: 1 }),
    evento({ id: 2, title: 'Turno médico', type: 'cita_medica', date: '2026-09-10', description: 'Dentista' }),
    evento({ id: 3, title: 'Cena con amigos', type: 'evento', date: '2026-07-16' }),
  ];

  it('busca en el título', () => {
    expect(filterEvents(events, 'mama').map((e) => e.id)).toEqual([1]);
  });

  it('busca en la descripción', () => {
    expect(filterEvents(events, 'dentista').map((e) => e.id)).toEqual([2]);
  });

  it('busca por el nombre del tipo', () => {
    expect(filterEvents(events, 'cita medica').map((e) => e.id)).toEqual([2]);
  });

  it('busca por etiqueta', () => {
    const conEtiqueta = evento({ id: 4, title: 'Asado', tags: [{ id: 1, name: 'trabajo' }] });
    expect(filterEvents([...events, conEtiqueta], 'trabajo').map((e) => e.id)).toEqual([4]);
  });

  it('sin búsqueda devuelve todo', () => {
    expect(filterEvents(events, '')).toHaveLength(3);
  });

  it('devuelve vacío cuando no hay coincidencias', () => {
    expect(filterEvents(events, 'asado')).toEqual([]);
  });
});

describe('filterNotes', () => {
  const notes = [nota({ id: 1 }), nota({ id: 2, title: 'Ideas', content: 'Regalo para Ana' })];

  it('busca en el título y en el contenido', () => {
    expect(filterNotes(notes, 'super').map((n) => n.id)).toEqual([1]);
    expect(filterNotes(notes, 'regalo').map((n) => n.id)).toEqual([2]);
    expect(filterNotes(notes, 'cafe').map((n) => n.id)).toEqual([1]); // 'café' sin tilde
  });
});
