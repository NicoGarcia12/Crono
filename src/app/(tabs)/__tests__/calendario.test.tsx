import { render, screen } from '@testing-library/react-native';

import CalendarioScreen from '@/app/(tabs)/calendario';
import type { EventItem } from '@/types';
import { todayIso } from '@/utils/dates';

let mockEvents: EventItem[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// El store se mockea completo: la pantalla lee los eventos y, vía useTheme, el
// tema elegido — por eso el estado falso incluye esas ramas (+ greetingsSent,
// que usa la lista de "cumplen este mes").
jest.mock('@/store', () => ({
  useAppSelector: <T,>(
    selector: (state: {
      events: { items: EventItem[] };
      greetingsSent: { year: number; items: never[]; status: 'ready' };
      settings: { themePreference: 'sistema' };
    }) => T,
  ) =>
    selector({
      events: { items: mockEvents },
      greetingsSent: { year: new Date().getFullYear(), items: [], status: 'ready' },
      settings: { themePreference: 'sistema' },
    }),
  useAppDispatch: () => jest.fn(),
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
  tags: [],
  yearly: 0,
  isMine: 0,
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
