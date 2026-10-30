import type * as Toolkit from '@reduxjs/toolkit';
import type * as ReactModule from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import PerfilScreen from '@/app/(tabs)/perfil';
import { confirmAction } from '@/components/confirm';
import { setSetting } from '@/db/settings-repo';
import { createTestStore, renderWithStore, type TestStore } from '@/test-utils';

/**
 * Perfil (CRONO44):
 *  - Exportar la copia pide confirmación ("tu copia se puede leer") antes de
 *    abrir Compartir/descargar; cancelar no exporta.
 *  - El botón "?" ("Ver recorrido de la app") reactiva el recorrido y lleva a Agenda.
 */

const mockPush = jest.fn<void, [string]>();
const mockNavigate = jest.fn<void, [string]>();
const mockReplace = jest.fn<void, [string]>();
const mockExport = jest.fn<Promise<void>, []>();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: mockNavigate, replace: mockReplace }),
  // Pantalla siempre "enfocada": el efecto corre al montar (la fila Avisos refresca el permiso así).
  useFocusEffect: (effect: ReactModule.EffectCallback) =>
    jest.requireActual<typeof ReactModule>('react').useEffect(effect, [effect]),
}));
jest.mock('@/components/confirm', () => ({ confirmAction: jest.fn(), notify: jest.fn() }));
// La fila "Avisos" consulta el permiso al montar: acá no importa, queda fijo en concedido.
jest.mock('@/notifications/notifications', () => ({
  ...jest.requireActual<object>('@/notifications/notifications'),
  getNotificationPermissionState: jest.fn().mockResolvedValue('granted'),
}));
jest.mock('@/db/settings-repo');
// El thunk real abre Compartir / descarga un archivo: se reemplaza por uno que solo registra la llamada.
jest.mock('@/store/backup-slice', () => {
  const { createAsyncThunk } = jest.requireActual<typeof Toolkit>('@reduxjs/toolkit');
  return {
    exportBackup: createAsyncThunk('backup/export', () => mockExport()),
    restoreBackup: createAsyncThunk('backup/restore', async () => null),
  };
});
// Piezas del perfil ajenas a estos casos (selector de fotos y fecha nativa).
jest.mock('@/components/photo-picker', () => ({ PhotoPicker: () => null }));
jest.mock('@/components/my-birthday-card', () => ({ MyBirthdayCard: () => null }));

const mockConfirm = jest.mocked(confirmAction);
const mockSetSetting = jest.mocked(setSetting);

/** Agenda es la ruta índice del grupo (tabs): '/', '/(tabs)' o '/(tabs)/index' llevan ahí. */
const AGENDA_HREF = /^\/(\(tabs\)(\/index)?)?$/;

async function renderPerfil(): Promise<TestStore> {
  const store = createTestStore({ settings: { displayName: 'Nico', loaded: true, onboardingTourDone: true } });
  await renderWithStore(<PerfilScreen />, { store });
  return store;
}

const tocarExportar = () =>
  fireEvent.press(screen.getByRole('button', { name: 'Exportar copia de seguridad' }));

beforeEach(() => {
  jest.clearAllMocks();
  mockExport.mockResolvedValue(undefined);
  mockSetSetting.mockResolvedValue(undefined);
});

describe('<PerfilScreen /> exportar copia', () => {
  it('pide confirmación al tocar Exportar', async () => {
    mockConfirm.mockResolvedValue(true);
    await renderPerfil();

    await tocarExportar();

    expect(mockConfirm).toHaveBeenCalledTimes(1);
  });

  it('si confirma, exporta después de la confirmación', async () => {
    mockConfirm.mockResolvedValue(true);
    await renderPerfil();

    await tocarExportar();

    await waitFor(() => expect(mockExport).toHaveBeenCalledTimes(1));
    const [confirmadoEn] = mockConfirm.mock.invocationCallOrder;
    const [exportadoEn] = mockExport.mock.invocationCallOrder;
    // Sin confirmación previa, `confirmadoEn` queda undefined → Infinity hace fallar el orden con un mensaje legible.
    expect(confirmadoEn ?? Infinity).toBeLessThan(exportadoEn);
  });

  it('si cancela, no exporta', async () => {
    mockConfirm.mockResolvedValue(false);
    await renderPerfil();

    await tocarExportar();

    await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
    expect(mockExport).not.toHaveBeenCalled();
  });
});

describe('<PerfilScreen /> ver recorrido de la app', () => {
  it('reactiva el recorrido en el store', async () => {
    const store = await renderPerfil();

    await fireEvent.press(screen.getByRole('button', { name: 'Ver recorrido de la app' }));

    await waitFor(() => expect(store.getState().settings.onboardingTourDone).toBe(false));
  });

  it("persiste el recorrido como pendiente ('0')", async () => {
    await renderPerfil();

    await fireEvent.press(screen.getByRole('button', { name: 'Ver recorrido de la app' }));

    await waitFor(() => expect(mockSetSetting).toHaveBeenCalledWith('onboardingTourDone', '0'));
  });

  it('lleva a Agenda', async () => {
    await renderPerfil();

    await fireEvent.press(screen.getByRole('button', { name: 'Ver recorrido de la app' }));

    await waitFor(() => {
      const hrefs = [mockPush, mockNavigate, mockReplace].flatMap((fn) => fn.mock.calls.map(([href]) => href));
      expect(hrefs).toEqual(expect.arrayContaining([expect.stringMatching(AGENDA_HREF)]));
    });
  });
});
