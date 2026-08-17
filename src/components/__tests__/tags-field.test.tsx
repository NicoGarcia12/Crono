import { fireEvent, screen } from '@testing-library/react-native';

import { TagsField } from '@/components/tags-field';
import { renderWithStore } from '@/test-utils';

const props = {
  value: ['familia'],
  onChange: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe('<TagsField />', () => {
  it('muestra las etiquetas ya elegidas', async () => {
    await renderWithStore(<TagsField {...props} />);

    expect(screen.getByText('familia')).toBeTruthy();
  });

  it('agrega una etiqueta nueva', async () => {
    await renderWithStore(<TagsField {...props} />);

    await fireEvent.changeText(screen.getByLabelText('Nueva etiqueta'), 'amigos');
    await fireEvent.press(screen.getByLabelText('Agregar etiqueta'));

    expect(props.onChange).toHaveBeenCalledWith(['familia', 'amigos']);
  });

  it('no duplica una etiqueta que ya está (sin importar mayúsculas)', async () => {
    await renderWithStore(<TagsField {...props} />);

    await fireEvent.changeText(screen.getByLabelText('Nueva etiqueta'), 'Familia');
    await fireEvent.press(screen.getByLabelText('Agregar etiqueta'));

    expect(props.onChange).not.toHaveBeenCalled();
  });

  it('quita una etiqueta', async () => {
    await renderWithStore(<TagsField {...props} value={['familia', 'trabajo']} />);

    await fireEvent.press(screen.getByLabelText('Quitar etiqueta trabajo'));

    expect(props.onChange).toHaveBeenCalledWith(['familia']);
  });
});
