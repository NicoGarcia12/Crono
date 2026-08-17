import { fireEvent, screen } from '@testing-library/react-native';

import { EventTypeForm } from '@/components/event-type-form';
import { renderWithStore } from '@/test-utils';
import type { EventTypeMeta } from '@/types';

const props = {
  onSubmit: jest.fn(),
  onCancel: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe('<EventTypeForm />', () => {
  it('no permite guardar sin nombre', async () => {
    await renderWithStore(<EventTypeForm {...props} />);

    await fireEvent.press(screen.getByText('Guardar'));

    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('crea un tipo nuevo con el nombre, ícono y color elegidos', async () => {
    await renderWithStore(<EventTypeForm {...props} />);

    await fireEvent.changeText(screen.getByLabelText('Nombre del tipo'), 'Torneo');
    await fireEvent.press(screen.getByLabelText('Ícono star'));
    await fireEvent.press(screen.getByLabelText('Color #4CAF50'));
    await fireEvent.press(screen.getByText('Guardar'));

    expect(props.onSubmit).toHaveBeenCalledWith({
      label: 'Torneo',
      icon: 'star',
      color: '#4CAF50',
      defaultYearly: false,
    });
  });

  it('al editar, arranca con los valores del tipo existente', async () => {
    const initial: EventTypeMeta = {
      id: 3,
      key: 'cumpleanos',
      label: 'Cumpleaños',
      icon: 'gift',
      color: '#E91E63',
      defaultYearly: true,
      isBuiltin: true,
    };
    await renderWithStore(<EventTypeForm {...props} initial={initial} />);

    expect(screen.getByDisplayValue('Cumpleaños')).toBeTruthy();

    await fireEvent.press(screen.getByText('Guardar'));

    expect(props.onSubmit).toHaveBeenCalledWith({
      label: 'Cumpleaños',
      icon: 'gift',
      color: '#E91E63',
      defaultYearly: true,
    });
  });

  it('cancelar avisa sin guardar', async () => {
    await renderWithStore(<EventTypeForm {...props} />);

    await fireEvent.press(screen.getByText('Cancelar'));

    expect(props.onCancel).toHaveBeenCalled();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });
});
