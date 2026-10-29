import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { showError } from '@/components/confirm';
import { PhotoPicker } from '@/components/photo-picker';
import { pickPhoto } from '@/media/photos';
import { renderWithStore } from '@/test-utils';

jest.mock('@/media/photos', () => ({ pickPhoto: jest.fn() }));
jest.mock('@/components/confirm', () => ({ showError: jest.fn() }));

const mockPick = jest.mocked(pickPhoto);

const props = {
  uri: null as string | null,
  onChange: jest.fn(),
  accessibilityLabel: 'Elegir foto del evento',
};

beforeEach(() => jest.clearAllMocks());

describe('<PhotoPicker />', () => {
  it('al tocarlo abre el selector y entrega la foto elegida sin copiarla', async () => {
    mockPick.mockResolvedValue('file:///cache/ImagePicker/elegida.jpg');
    await renderWithStore(<PhotoPicker {...props} />);

    await fireEvent.press(screen.getByLabelText('Elegir foto del evento'));

    expect(props.onChange).toHaveBeenCalledWith('file:///cache/ImagePicker/elegida.jpg');
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

  it('si guardar la elección rechaza, avisa el error en vez de perderlo', async () => {
    mockPick.mockResolvedValue('file:///cache/ImagePicker/elegida.jpg');
    const failure = new Error('disco lleno');
    props.onChange.mockRejectedValueOnce(failure);
    await renderWithStore(<PhotoPicker {...props} />);

    await fireEvent.press(screen.getByLabelText('Elegir foto del evento'));

    await waitFor(() => expect(showError).toHaveBeenCalledWith(expect.any(String), failure));
  });

  it('sin foto, no ofrece sacarla', async () => {
    await renderWithStore(<PhotoPicker {...props} />);

    expect(screen.queryByLabelText('Quitar foto')).toBeNull();
  });
});
