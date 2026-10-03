import { fireEvent, screen } from '@testing-library/react-native';

import { EventTypeForm } from '@/components/event-type-form';
import { renderWithStore } from '@/test-utils';
import type { EventTypeMeta } from '@/types';

const props = {
  onSubmit: jest.fn(),
  onCancel: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

const cumpleanos: EventTypeMeta = {
  id: 2,
  key: 'cumpleanos',
  label: 'Cumpleaños',
  icon: 'gift',
  color: '#E91E63',
  defaultYearly: true,
  isBuiltin: true,
  baseKey: 'cumpleanos',
  extraCapabilities: [],
  hidden: false,
};

describe('<EventTypeForm />', () => {
  it('no permite guardar sin nombre', async () => {
    await renderWithStore(<EventTypeForm {...props} />);

    await fireEvent.press(screen.getByText('Guardar'));

    expect(props.onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Ponele un nombre al tipo.')).toBeTruthy();
  });

  it('crea un tipo nuevo a partir de una base, con extras y campos', async () => {
    await renderWithStore(<EventTypeForm {...props} />);

    await fireEvent.changeText(screen.getByLabelText('Nombre del tipo'), 'Cumple de oficina');
    await fireEvent.press(screen.getByLabelText('Ícono star'));
    await fireEvent.press(screen.getByLabelText('Color #4CAF50'));
    await fireEvent.press(screen.getByLabelText('Base Cumpleaños'));
    await fireEvent.press(screen.getByLabelText('Agregar campo'));
    await fireEvent.changeText(screen.getByLabelText('Nombre del campo 1'), 'Qué llevar');
    await fireEvent.press(screen.getByLabelText('Campo 1: Varias opciones'));
    await fireEvent.changeText(screen.getByLabelText('Opciones del campo 1'), 'Torta, Bebida');
    await fireEvent.press(screen.getByText('Guardar'));

    expect(props.onSubmit).toHaveBeenCalledWith({
      label: 'Cumple de oficina',
      icon: 'star',
      color: '#4CAF50',
      baseKey: 'cumpleanos',
      extraCapabilities: [],
      fields: [{ label: 'Qué llevar', kind: 'multi', options: ['Torta', 'Bebida'] }],
    });
  });

  it('lo que trae la base viene bloqueado y se cuenta para el límite', async () => {
    await renderWithStore(<EventTypeForm {...props} />);

    await fireEvent.press(screen.getByLabelText('Base Cumpleaños'));

    // edad, saludado, whatsapp, regalos = 4 de 15
    expect(screen.getByText('4 de 15')).toBeTruthy();
    expect(screen.getAllByText('Viene de la base')).toHaveLength(4);
  });

  it('no deja sumar una capacidad que rompe una regla, y explica por qué', async () => {
    await renderWithStore(<EventTypeForm {...props} />);

    // La base Evento no se repite: la edad necesita repetición anual.
    await fireEvent(screen.getByLabelText('Edad'), 'valueChange', true);

    expect(screen.getByText('La edad solo tiene sentido si se repite todos los años.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Nombre del tipo'), 'Torneo');
    await fireEvent.press(screen.getByText('Guardar'));
    expect(props.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ extraCapabilities: [] }));
  });

  it('un select sin opciones no se puede guardar', async () => {
    await renderWithStore(<EventTypeForm {...props} />);

    await fireEvent.changeText(screen.getByLabelText('Nombre del tipo'), 'Torneo');
    await fireEvent.press(screen.getByLabelText('Agregar campo'));
    await fireEvent.changeText(screen.getByLabelText('Nombre del campo 1'), 'Categoría');
    await fireEvent.press(screen.getByLabelText('Campo 1: Una opción'));
    await fireEvent.press(screen.getByText('Guardar'));

    expect(props.onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('"Categoría" necesita al menos una opción.')).toBeTruthy();
  });

  it('un tipo de fábrica solo edita el nombre', async () => {
    await renderWithStore(<EventTypeForm {...props} initial={cumpleanos} />);

    expect(screen.getByDisplayValue('Cumpleaños')).toBeTruthy();
    expect(screen.queryByLabelText('Agregar campo')).toBeNull();
    expect(screen.queryByLabelText('Ícono star')).toBeNull();
    expect(screen.queryByLabelText('Color #4CAF50')).toBeNull();
    await fireEvent.press(screen.getByText('Guardar'));

    expect(props.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Cumpleaños', icon: 'gift', color: '#E91E63', baseKey: 'cumpleanos' }),
    );
  });

  it('al editar un tipo propio se cambian el nombre y los extras, no el ícono ni el color', async () => {
    const torneo: EventTypeMeta = { ...cumpleanos, id: 20, key: 'torneo', label: 'Torneo', icon: 'star', color: '#000', isBuiltin: false, baseKey: 'evento' };
    await renderWithStore(<EventTypeForm {...props} initial={torneo} />);

    expect(screen.queryByLabelText('Ícono star')).toBeNull();
    expect(screen.getByLabelText('Agregar campo')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Nombre del tipo'), 'Torneo de fútbol');
    await fireEvent.press(screen.getByText('Guardar'));

    expect(props.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Torneo de fútbol', icon: 'star', color: '#000' }),
    );
  });

  it('cancelar avisa sin guardar', async () => {
    await renderWithStore(<EventTypeForm {...props} />);

    await fireEvent.press(screen.getByText('Cancelar'));

    expect(props.onCancel).toHaveBeenCalled();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });
});
