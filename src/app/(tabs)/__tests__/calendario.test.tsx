import { render, screen } from '@testing-library/react-native';

import CalendarioScreen from '@/app/(tabs)/calendario';
import type { EventItem } from '@/types';
import { todayIso } from '@/utils/dates';

let mockEvents: EventItem[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/store', () => ({
  useAppSelector: (
    selector: (state: { events: { items: EventItem[] } }) => EventItem[],
  ) => selector({ events: { items: mockEvents } }),
}));

jest.mock('@/components/event-card', () => ({
  EventCard: () => null,
}));

const event = (id: number): EventItem => ({
  id,
  title: `Evento ${id}`,
  type: 'evento',
  date: todayIso(),
  time: null,
  description: null,
  contactId: null,
  phone: null,
  reminders: [],
  yearly: 0,
});

describe('<CalendarioScreen />', () => {
  beforeEach(() => {
    mockEvents = Array.from({ length: 100 }, (_, index) => event(index + 1));
  });

  it('expone la FlatList del detalle diario para muchos eventos', async () => {
    await render(<CalendarioScreen />);

    expect(screen.getByTestId('lista-virtualizada-eventos-del-dia')).toBeTruthy();
  });
});
