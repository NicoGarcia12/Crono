import { screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { CalendarGrid } from '@/components/calendar-grid';
import { CountdownBanner } from '@/components/countdown-banner';
import { EventCard } from '@/components/event-card';
import { renderWithStore } from '@/test-utils';
import type { EventItem } from '@/types';
import { buildMonthGrid, eventsByDay } from '@/utils/calendar';
import { toLocalDate } from '@/utils/dates';

const original = Object.freeze<EventItem>({
  id: 38,
  title: 'Cumple del 29 de febrero',
  type: 'cumpleanos',
  date: '2000-02-29',
  time: null,
  description: null,
  contactId: null,
  phone: null,
  reminders: [],
  yearly: 1,
  isMine: 0,
  tags: [],
  photoUri: null,
  yearUnknown: 0,
});

describe('recurrencia 29/2 en agenda, calendario y countdown', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each([
    { from: '2027-02-27', year: 2027, day: 28, relative: 'Mañana', countdown: 'Falta 1 día' },
    { from: '2027-02-28', year: 2027, day: 28, relative: 'Hoy', countdown: 'Es hoy' },
    { from: '2027-03-01', year: 2028, day: 29, relative: '29 feb 2028', countdown: 'Faltan 365 días' },
    { from: '2027-12-31', year: 2028, day: 29, relative: '29 feb 2028', countdown: 'Faltan 60 días' },
    { from: '2028-02-28', year: 2028, day: 29, relative: 'Mañana', countdown: 'Falta 1 día' },
    { from: '2028-02-29', year: 2028, day: 29, relative: 'Hoy', countdown: 'Es hoy' },
    { from: '2028-03-01', year: 2029, day: 28, relative: '28 feb 2029', countdown: 'Faltan 364 días' },
  ])('muestra la misma ocurrencia desde $from sin modificar el original', async ({ from, year, day, relative, countdown }) => {
    // Fijamos el reloj JS, pero no mockeamos los cálculos ni los componentes consumidores.
    // Esto verifica lo que renderiza React; no equivale a ejecutar Fabric o el scheduler del SO.
    jest.setSystemTime(toLocalDate(from, '23:59'));
    const weeks = buildMonthGrid(new Date(year, 1, 1));
    const byDay = eventsByDay([original], weeks.flat());

    await renderWithStore(
      <View>
        <EventCard event={original} />
        <CountdownBanner event={original} />
        <CalendarGrid
          weeks={weeks}
          eventsByDay={byDay}
          currentMonth={1}
          selectedIso={`${year}-02-${day}`}
          onSelect={jest.fn()}
        />
      </View>,
    );

    expect(screen.getByText(relative)).toBeTruthy();
    expect(screen.getByText(countdown)).toBeTruthy();
    expect(screen.getByText(new RegExp(`${day} de febrero de ${year}`))).toBeTruthy();
    expect(screen.getByRole('button', {
      name: new RegExp(`^Día ${day} de febrero de ${year}, 1 evento:`),
    })).toBeTruthy();
    expect(original.date).toBe('2000-02-29');
  });
});
