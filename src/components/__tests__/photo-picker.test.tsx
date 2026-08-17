import { fireEvent, screen } from '@testing-library/react-native';

import { PhotoPicker } from '@/components/photo-picker';
import { pickAndSavePhoto } from '@/media/photos';
import { renderWithStore } from '@/test-utils';

jest.mock('@/media/photos', () => ({ pickAndSavePhoto: jest.fn() }));

const mockPick = jest.mocked(pickAndSavePhoto);

const props = {
  uri: null as string | null,
  onChange: jest.fn(),
  accessibilityLabel: 'Elegir foto del evento',
  filePrefix: 'evento',
};

beforeEach(() => jest.clearAllMocks());

describe('<PhotoPicker />', () => {
  it('al tocarlo abre el selector y avisa con la foto guardada', async () => {
    mockPick.mockResolvedValue('file:///photos/evento-123.jpg');
    await renderWithStore(<PhotoPicker {...props} />);

    await fireEvent.press(screen.getByLabelText('Elegir foto del evento'));

    expect(mockPick).toHaveBeenCalledWith('evento');
    expect(props.onChange).toHaveBeenCalledWith('file:///photos/evento-123.jpg');
  });

  it('si se cancela el selector, no avisa ningún cambio', async () => {
    mockPick.mockResolvedValue(null);
    await renderWithStore(<PhotoPicker {...props} />);

    await fireEvent.press(screen.getByLabelText('Elegir foto del evento'));

    expect(props.onChange).not.toHaveBeenCalled();
  });

  it('con una foto puesta, ofrece sacarla', async () => {
    await renderWithStore(<PhotoPicker {...props} uri="file:///photos/evento-123.jpg" />);

    await fireEvent.press(screen.getByLabelText('Quitar foto'));

    expect(props.onChange).toHaveBeenCalledWith(null);
  });

  it('sin foto, no ofrece sacarla', async () => {
    await renderWithStore(<PhotoPicker {...props} />);

    expect(screen.queryByLabelText('Quitar foto')).toBeNull();
  });
});
