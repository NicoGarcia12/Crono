import { Alert } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';

import { GiftIdeasList } from '@/components/gift-ideas-list';
import { renderWithStore } from '@/test-utils';
import type { GiftIdea } from '@/types';

const items: GiftIdea[] = [
  { id: 1, eventId: 1, text: 'Campera', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 2, eventId: 1, text: 'Entradas al cine', createdAt: '2026-01-02T00:00:00.000Z' },
];

const props = {
  items,
  onAdd: jest.fn(),
  onEdit: jest.fn(),
  onGiven: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe('<GiftIdeasList />', () => {
  it('muestra las ideas cargadas', async () => {
    await renderWithStore(<GiftIdeasList {...props} />);

    expect(screen.getByText('Campera')).toBeTruthy();
    expect(screen.getByText('Entradas al cine')).toBeTruthy();
  });

  it('muestra un mensaje cuando no hay ideas', async () => {
    await renderWithStore(<GiftIdeasList {...props} items={[]} />);

    expect(screen.getByText('Todavía no anotaste ideas. Agregá las que se te ocurran.')).toBeTruthy();
  });

  it('agrega una idea nueva', async () => {
    await renderWithStore(<GiftIdeasList {...props} />);

    await fireEvent.changeText(screen.getByLabelText('Nueva idea de regalo'), 'Libro');
    await fireEvent.press(screen.getByLabelText('Agregar idea'));

    expect(props.onAdd).toHaveBeenCalledWith('Libro');
  });

  it('no agrega una idea vacía', async () => {
    await renderWithStore(<GiftIdeasList {...props} />);

    await fireEvent.press(screen.getByLabelText('Agregar idea'));

    expect(props.onAdd).not.toHaveBeenCalled();
  });

  it('edita el texto de una idea al tocarla', async () => {
    await renderWithStore(<GiftIdeasList {...props} />);

    await fireEvent.press(screen.getByLabelText('Editar idea "Campera"'));
    await fireEvent.changeText(screen.getByLabelText('Editar idea "Campera"'), 'Campera de cuero');
    await fireEvent(screen.getByLabelText('Editar idea "Campera"'), 'submitEditing');

    expect(props.onEdit).toHaveBeenCalledWith(1, 'Campera de cuero');
  });

  it('marca una idea como regalada tras confirmar', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      buttons?.find((b) => b.text === 'Ya se lo di')?.onPress?.();
    });
    await renderWithStore(<GiftIdeasList {...props} />);

    await fireEvent.press(screen.getByLabelText('Marcar "Campera" como regalado'));

    expect(props.onGiven).toHaveBeenCalledWith(items[0]);
  });

  it('no saca la idea si se cancela la confirmación', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderWithStore(<GiftIdeasList {...props} />);

    await fireEvent.press(screen.getByLabelText('Marcar "Campera" como regalado'));

    expect(props.onGiven).not.toHaveBeenCalled();
  });
});
