import { fireEvent, screen } from '@testing-library/react-native';

import { MonthBirthdaysList } from '@/components/month-birthdays-list';
import { renderWithStore } from '@/test-utils';
import type { EventItem } from '@/types';

const evento = (over: Partial<EventItem> & { id: number; title: string }): EventItem => ({
  type: 'cumpleanos',
  date: '2026-07-20',
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

const people: EventItem[] = [
  evento({ id: 1, title: 'Cumpleaños de Ana' }),
  evento({ id: 2, title: 'Aniversario de Bruno y Carla', type: 'aniversario' }),
];

const props = {
  people,
  greetedEventIds: new Set<number>(),
  onToggle: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe('<MonthBirthdaysList />', () => {
  it('muestra a quienes cumplen este mes', async () => {
    await renderWithStore(<MonthBirthdaysList {...props} />);

    expect(screen.getByText('Cumplen este mes')).toBeTruthy();
    expect(screen.getByText('Cumpleaños de Ana')).toBeTruthy();
    expect(screen.getByText('Aniversario de Bruno y Carla')).toBeTruthy();
  });

  it('no renderiza nada si no hay nadie ese mes', async () => {
    await renderWithStore(<MonthBirthdaysList {...props} people={[]} />);

    expect(screen.queryByText('Cumplen este mes')).toBeNull();
  });

  it('marca que ya saludé al tocar la fila', async () => {
    await renderWithStore(<MonthBirthdaysList {...props} />);

    await fireEvent.press(screen.getByLabelText('Marcar que ya saludé a Cumpleaños de Ana'));

    expect(props.onToggle).toHaveBeenCalledWith(people[0]);
  });

  it('ofrece desmarcar a quien ya está saludado', async () => {
    await renderWithStore(<MonthBirthdaysList {...props} greetedEventIds={new Set([1])} />);

    expect(screen.getByLabelText('Desmarcar que ya saludé a Cumpleaños de Ana')).toBeTruthy();
  });
});
