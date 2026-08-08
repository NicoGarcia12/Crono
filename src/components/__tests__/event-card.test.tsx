import { screen } from '@testing-library/react-native';

import { EventCard } from '@/components/event-card';
import { renderWithStore } from '@/test-utils';
import type { EventItem } from '@/types';

const miCumple: EventItem = {
  id: 7,
  title: 'Cumpleaños de Nico',
  type: 'cumpleanos',
  date: '1996-08-10',
  time: null,
  description: null,
  contactId: null,
  phone: null,
  reminders: [],
  yearly: 1,
  isMine: 1,
};

describe('<EventCard />', () => {
  it('muestra “Mi cumpleaños” cuando el evento está marcado como propio', async () => {
    await renderWithStore(<EventCard event={miCumple} />);

    expect(screen.getByText('Mi cumpleaños')).toBeTruthy();
  });
});
