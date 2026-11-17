import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { showError } from '@/components/confirm';
import { PhotoPicker } from '@/components/photo-picker';
import { pickPhoto } from '@/media/photos';
import { reportUnavailable } from '@/platform/runtime';
import { renderWithStore } from '@/test-utils';

jest.mock('@/media/photos', () => ({ pickPhoto: jest.fn() }));
jest.mock('@/components/confirm', () => ({ showError: jest.fn() }));
/** true = hay selector de fotos (celular); false = web. */
let mockPhotosAvailable = true;
jest.mock('@/platform/runtime', () => ({
  ...jest.requireActual<object>('@/platform/runtime'),
  isAvailable: () => mockPhotosAvailable,
  reportUnavailable: jest.fn(),
}));

const mockPick = jest.mocked(pickPhoto);
const mockReportUnavailable = jest.mocked(reportUnavailable);

const props = {
  uri: null as string | null,
  onChange: jest.fn(),
  accessibilityLabel: 'Elegir foto del evento',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPhotosAvailable = true;
});

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

    await waitFor(() => expect(showError).toHaveBeenCalledWith('No se pudo elegir la foto', failure));
  });

  it('si el selector no está disponible (web), muestra el mismo botón y lo reporta sin abrir nada', async () => {
    mockPhotosAvailable = false;
    await renderWithStore(<PhotoPicker {...props} />);

    await fireEvent.press(screen.getByLabelText('Elegir foto del evento'));

    expect(mockReportUnavailable).toHaveBeenCalledWith('photos', 'No se pudo elegir la foto');
    expect(mockPick).not.toHaveBeenCalled();
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it('sin foto, no ofrece sacarla', async () => {
    await renderWithStore(<PhotoPicker {...props} />);

    expect(screen.queryByLabelText('Quitar foto')).toBeNull();
  });
});
