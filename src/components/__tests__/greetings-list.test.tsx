import { fireEvent, screen } from '@testing-library/react-native';

import { GreetingsList } from '@/components/greetings-list';
import type { GreetingRow } from '@/greetings/greetings';
import { renderWithStore } from '@/test-utils';

const fila = (over: Partial<GreetingRow> & { key: string; name: string }): GreetingRow => ({
  phone: null,
  greeted: false,
  eventId: 1,
  greetingId: null,
  isGuest: false,
  ...over,
});

const rows: GreetingRow[] = [
  fila({ key: 'evento:1', name: 'Ana', eventId: 1 }),
  fila({ key: 'evento:2', name: 'Bruno', eventId: 2, greeted: true, greetingId: 10 }),
  fila({ key: 'invitado:11', name: 'Carla', eventId: null, greetingId: 11, isGuest: true, greeted: true }),
];

const props = {
  year: 2026,
  rows,
  onChangeYear: jest.fn(),
  onToggle: jest.fn(),
  onAddGuest: jest.fn(),
  onAddBirthday: jest.fn(),
  onRemoveGuest: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe('<GreetingsList />', () => {
  it('muestra el año, el resumen y quiénes saludaron', async () => {
    await renderWithStore(<GreetingsList {...props} />);

    expect(screen.getByText('¿Quién me saludó en 2026?')).toBeTruthy();
    expect(screen.getByText('Te saludaron 2 de 3')).toBeTruthy();
    expect(screen.getByText('No está en tu agenda')).toBeTruthy(); // Carla, anotada a mano
  });

  it('tilda a alguien que me saludó', async () => {
    await renderWithStore(<GreetingsList {...props} />);

    await fireEvent.press(screen.getByLabelText('Marcar saludo de Ana'));

    expect(props.onToggle).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ana' }));
  });

  it('destilda a alguien que ya estaba marcado', async () => {
    await renderWithStore(<GreetingsList {...props} />);

    await fireEvent.press(screen.getByLabelText('Desmarcar saludo de Bruno'));

    expect(props.onToggle).toHaveBeenCalledWith(expect.objectContaining({ name: 'Bruno' }));
  });

  it('suma a alguien que no está en la agenda', async () => {
    await renderWithStore(<GreetingsList {...props} />);

    await fireEvent.changeText(screen.getByLabelText('Nombre de quien me saludó'), 'Diego');
    await fireEvent.changeText(screen.getByLabelText('Teléfono de quien me saludó'), '+54 11 5555-0004');
    await fireEvent.press(screen.getByLabelText('Sumar a la lista'));

    expect(props.onAddGuest).toHaveBeenCalledWith('Diego', '+54 11 5555-0004');
  });

  it('no suma a nadie sin nombre', async () => {
    await renderWithStore(<GreetingsList {...props} />);

    await fireEvent.press(screen.getByLabelText('Sumar a la lista'));

    expect(props.onAddGuest).not.toHaveBeenCalled();
  });

  it('deja cargarle el cumpleaños o sacar de la lista a los anotados a mano', async () => {
    await renderWithStore(<GreetingsList {...props} />);

    await fireEvent.press(screen.getByLabelText('Agregar cumpleaños de Carla'));
    expect(props.onAddBirthday).toHaveBeenCalledWith(expect.objectContaining({ name: 'Carla' }));

    await fireEvent.press(screen.getByLabelText('Sacar a Carla de la lista'));
    expect(props.onRemoveGuest).toHaveBeenCalledWith(expect.objectContaining({ name: 'Carla' }));

    // Los de la agenda no tienen esas acciones.
    expect(screen.queryByLabelText('Agregar cumpleaños de Ana')).toBeNull();
  });

  it('permite mirar otros años', async () => {
    await renderWithStore(<GreetingsList {...props} />);

    await fireEvent.press(screen.getByLabelText('Año anterior'));
    expect(props.onChangeYear).toHaveBeenCalledWith(2025);

    await fireEvent.press(screen.getByLabelText('Año siguiente'));
    expect(props.onChangeYear).toHaveBeenCalledWith(2027);
  });
});
