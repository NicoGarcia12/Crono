import { screen } from '@testing-library/react-native';

import { renderWithStore } from '@/test-utils';

import { CalendarGrid } from '@/components/calendar-grid';
import type { EventItem } from '@/types';

const event = (overrides: Partial<EventItem> & { id: number }): EventItem => ({
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
  ...overrides,
});

describe('<CalendarGrid />', () => {
  const selectedIso = '2026-07-15';
  const accessibleDay = 'Día 15 de julio de 2026, 2 eventos: Cumpleaños y Cita médica, seleccionado';

  const renderGrid = async () => {
    const dayEvents = [
      event({ id: 1, type: 'cumpleanos' }),
      event({ id: 2, type: 'cita_medica' }),
    ];

    await renderWithStore(
      <CalendarGrid
        weeks={[[new Date(2026, 6, 15)]]}
        eventsByDay={new Map([[selectedIso, dayEvents]])}
        currentMonth={6}
        selectedIso={selectedIso}
        onSelect={jest.fn()}
      />,
    );
  };

  it('describe el día con la cantidad y los tipos de eventos', async () => {
    await renderGrid();

    expect(screen.getByLabelText(accessibleDay)).toBeTruthy();
  });

  it('expone que el día está seleccionado para lectores de pantalla', async () => {
    await renderGrid();

    expect(screen.getByRole('button', { name: accessibleDay, selected: true })).toBeTruthy();
  });
});
