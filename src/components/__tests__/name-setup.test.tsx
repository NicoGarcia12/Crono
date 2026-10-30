import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { currentDialog, resolveDialog } from '@/components/confirm';
import { DialogHost } from '@/components/dialog-host';
import { NameSetup } from '@/components/name-setup';
import { setSetting } from '@/db/settings-repo';
import { renderWithStore } from '@/test-utils';

/**
 * Permiso de notificaciones después de la bienvenida (CRONO44): al tocar
 * "Empezar", si el entorno programa recordatorios, primero se explica para
 * qué sirven los avisos (diálogo propio de Crono) y recién al cerrarlo se pide
 * el permiso del sistema. En web / Expo Go Android no hay diálogo ni pedido.
 */

let mockRemindersAvailable = true;
const mockRequestPermission = jest.fn<Promise<boolean>, []>();

jest.mock('@/notifications/notifications', () => ({
  get remindersAvailable() {
    return mockRemindersAvailable;
  },
  requestNotificationPermission: () => mockRequestPermission(),
}));
jest.mock('@/db/settings-repo');

const mockSetSetting = jest.mocked(setSetting);

async function empezarComo(nombre: string) {
  await renderWithStore(
    <>
      <NameSetup />
      <DialogHost />
    </>,
  );
  await fireEvent.changeText(screen.getByPlaceholderText('¿Cómo te llamás?'), nombre);
  await fireEvent.press(screen.getByText('Empezar'));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRemindersAvailable = true;
  mockRequestPermission.mockResolvedValue(true);
  mockSetSetting.mockResolvedValue(undefined);
});

/** Cierra todos los diálogos en cola (la cola es global, vive fuera de React). */
function cerrarDialogos() {
  for (let dialog = currentDialog(); dialog; dialog = currentDialog()) resolveDialog(dialog.id, false);
}

// Si un test falla con un diálogo abierto, no debe pasar al siguiente.
afterEach(cerrarDialogos);

describe('<NameSetup /> con recordatorios disponibles', () => {
  it('al tocar Empezar muestra el diálogo explicativo de los avisos', async () => {
    await empezarComo('Nico');

    expect(await screen.findByRole('button', { name: 'Entendido' })).toBeTruthy();
  });

  it('no pide el permiso mientras el diálogo explicativo está abierto', async () => {
    await empezarComo('Nico');
    await screen.findByRole('button', { name: 'Entendido' });

    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('pide el permiso del sistema al cerrar el diálogo', async () => {
    await empezarComo('Nico');

    await fireEvent.press(await screen.findByRole('button', { name: 'Entendido' }));

    await waitFor(() => expect(mockRequestPermission).toHaveBeenCalledTimes(1));
  });

  it('guarda el nombre después de explicar y pedir el permiso', async () => {
    await empezarComo('Nico');

    await fireEvent.press(await screen.findByRole('button', { name: 'Entendido' }));

    await waitFor(() => expect(mockSetSetting).toHaveBeenCalledWith('displayName', 'Nico'));
  });

  it('guarda el nombre aunque el permiso se niegue', async () => {
    mockRequestPermission.mockResolvedValue(false);
    await empezarComo('Nico');

    await fireEvent.press(await screen.findByRole('button', { name: 'Entendido' }));

    await waitFor(() => expect(mockSetSetting).toHaveBeenCalledWith('displayName', 'Nico'));
  });
});

describe('<NameSetup /> sin recordatorios disponibles (web / Expo Go Android)', () => {
  beforeEach(() => {
    mockRemindersAvailable = false;
  });

  it('guarda el nombre directamente', async () => {
    await empezarComo('Nico');

    await waitFor(() => expect(mockSetSetting).toHaveBeenCalledWith('displayName', 'Nico'));
  });

  it('no muestra el diálogo explicativo', async () => {
    await empezarComo('Nico');
    await waitFor(() => expect(mockSetSetting).toHaveBeenCalledWith('displayName', 'Nico'));

    expect(screen.queryByRole('button', { name: 'Entendido' })).toBeNull();
  });

  it('no pide el permiso de notificaciones', async () => {
    await empezarComo('Nico');
    await waitFor(() => expect(mockSetSetting).toHaveBeenCalledWith('displayName', 'Nico'));

    expect(mockRequestPermission).not.toHaveBeenCalled();
  });
});

/**
 * CRONO44 ronda 2: si guardar el nombre falla, la bienvenida avisa el error
 * y deja reintentar. El permiso ya se explicó y se pidió: el reintento solo
 * vuelve a guardar el nombre.
 */
describe('<NameSetup /> si no se pudo guardar el nombre', () => {
  beforeEach(() => {
    mockSetSetting.mockRejectedValueOnce(new Error('Disco lleno'));
  });

  it('muestra el error', async () => {
    await empezarComo('Nico');
    await fireEvent.press(await screen.findByRole('button', { name: 'Entendido' }));

    expect(await screen.findByText(/Disco lleno/)).toBeTruthy();
  });

  it('el reintento guarda el nombre sin repetir el diálogo explicativo', async () => {
    await empezarComo('Nico');
    await fireEvent.press(await screen.findByRole('button', { name: 'Entendido' }));
    await waitFor(() => expect(mockSetSetting).toHaveBeenCalledTimes(1));
    await act(async () => cerrarDialogos()); // cierra el aviso de error, si lo hay

    await fireEvent.press(screen.getByText('Empezar'));

    // Si volviera a mostrarse el diálogo explicativo, el guardado quedaría esperando "Entendido".
    await waitFor(() => expect(mockSetSetting).toHaveBeenCalledTimes(2));
    expect(mockSetSetting).toHaveBeenLastCalledWith('displayName', 'Nico');
  });

  it('el reintento no vuelve a pedir el permiso', async () => {
    await empezarComo('Nico');
    await fireEvent.press(await screen.findByRole('button', { name: 'Entendido' }));
    await waitFor(() => expect(mockSetSetting).toHaveBeenCalledTimes(1));
    await act(async () => cerrarDialogos());

    await fireEvent.press(screen.getByText('Empezar'));
    // Si se repitiera el diálogo, se lo cierra para que un pedido posterior quede a la vista.
    await act(async () => cerrarDialogos());
    await waitFor(() => expect(mockSetSetting).toHaveBeenCalledTimes(2));

    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
  });
});
