import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useState } from 'react';
import { Platform, Text } from 'react-native';

import { LockScreen } from '@/components/lock-screen';
import { renderWithStore } from '@/test-utils';

// Jest corre en Node: simulamos la frontera nativa, no el diálogo ni la seguridad del SO.
jest.mock('expo-local-authentication', () => ({
  getEnrolledLevelAsync: jest.fn(),
  authenticateAsync: jest.fn(),
  hasHardwareAsync: jest.fn().mockResolvedValue(false),
  isEnrolledAsync: jest.fn().mockResolvedValue(false),
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
}));

const mockLevel = jest.mocked(LocalAuthentication.getEnrolledLevelAsync);
const mockAuthenticate = jest.mocked(LocalAuthentication.authenticateAsync);
const originalOS = Platform.OS;

function ProtectedApp() {
  const [unlocked, setUnlocked] = useState(false);
  return unlocked ? (
    <Text>Contenido privado</Text>
  ) : (
    <LockScreen onUnlock={() => setUnlocked(true)} />
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = 'android';
  mockLevel.mockResolvedValue(LocalAuthentication.SecurityLevel.SECRET);
  mockAuthenticate.mockResolvedValue({ success: false, error: 'user_cancel' });
});

afterEach(() => {
  Platform.OS = originalOS;
});

describe('<LockScreen />', () => {
  it.each(['android', 'ios'] as const)('solicita la credencial PIN-only en %s sin biometría', async (os) => {
    Platform.OS = os;
    mockAuthenticate.mockResolvedValue({ success: true });
    await renderWithStore(<ProtectedApp />);

    await waitFor(() => expect(screen.getByText('Contenido privado')).toBeTruthy());
    expect(mockAuthenticate).toHaveBeenCalledWith(
      expect.objectContaining({ disableDeviceFallback: false }),
    );
  });

  it.each([
    LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK,
    LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG,
  ])('acepta biometría nivel %s verificada por el SO', async (level) => {
    mockLevel.mockResolvedValue(level);
    mockAuthenticate.mockResolvedValue({ success: true });
    await renderWithStore(<ProtectedApp />);

    await waitFor(() => expect(screen.getByText('Contenido privado')).toBeTruthy());
  });

  it.each<LocalAuthentication.LocalAuthenticationError>([
    'user_cancel', 'system_cancel', 'app_cancel', 'authentication_failed', 'lockout',
    'timeout', 'not_available', 'not_enrolled', 'passcode_not_set', 'user_fallback',
  ])('no revela contenido ante %s', async (error) => {
    mockAuthenticate.mockResolvedValue({ success: false, error });
    await renderWithStore(<ProtectedApp />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Desbloquear' })).toBeEnabled());
    expect(mockAuthenticate).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Contenido privado')).toBeNull();
  });

  it('sin credencial mantiene el acceso cerrado y permite reintentar después de configurarla', async () => {
    mockLevel.mockResolvedValue(LocalAuthentication.SecurityLevel.NONE);
    await renderWithStore(<ProtectedApp />);

    await waitFor(() => expect(screen.getByText(/Configurá un PIN/)).toBeTruthy());
    expect(mockAuthenticate).not.toHaveBeenCalled();
    expect(screen.queryByText('Contenido privado')).toBeNull();

    mockLevel.mockResolvedValue(LocalAuthentication.SecurityLevel.SECRET);
    mockAuthenticate.mockResolvedValue({ success: true });
    await fireEvent.press(screen.getByRole('button', { name: 'Desbloquear' }));

    expect(screen.getByText('Contenido privado')).toBeTruthy();
  });

  it.each(['capability', 'authentication'] as const)('no desbloquea si lanza la consulta %s', async (failure) => {
    if (failure === 'capability') mockLevel.mockRejectedValueOnce(new Error('native unavailable'));
    else mockAuthenticate.mockRejectedValueOnce(new Error('native unavailable'));
    await renderWithStore(<ProtectedApp />);

    await waitFor(() => expect(screen.getByText(/No se pudo verificar/)).toBeTruthy());
    expect(screen.queryByText('Contenido privado')).toBeNull();
  });

  it('después de cancelar sólo un nuevo intento exitoso abre el contenido', async () => {
    await renderWithStore(<ProtectedApp />);
    await waitFor(() => expect(screen.getByText(/No se pudo verificar/)).toBeTruthy());
    expect(screen.queryByText('Contenido privado')).toBeNull();

    mockAuthenticate.mockResolvedValueOnce({ success: true });
    await fireEvent.press(screen.getByRole('button', { name: 'Desbloquear' }));

    expect(screen.getByText('Contenido privado')).toBeTruthy();
  });

  it('no abre otro prompt ni revela contenido mientras la autenticación está pendiente', async () => {
    const { promise, resolve: resolveAuthentication } =
      Promise.withResolvers<LocalAuthentication.LocalAuthenticationResult>();
    mockAuthenticate.mockReturnValueOnce(promise);
    await renderWithStore(<ProtectedApp />);
    await waitFor(() => expect(mockAuthenticate).toHaveBeenCalledTimes(1));

    const button = screen.getByRole('button', { name: 'Desbloquear' });
    expect(button).toBeDisabled();
    await fireEvent.press(button);
    expect(mockAuthenticate).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Contenido privado')).toBeNull();

    await act(async () => { resolveAuthentication({ success: false, error: 'user_cancel' }); });
    expect(screen.queryByText('Contenido privado')).toBeNull();
  });

  it('ignora una respuesta nativa tardía después de desmontarse', async () => {
    const { promise, resolve: resolveAuthentication } =
      Promise.withResolvers<LocalAuthentication.LocalAuthenticationResult>();
    mockAuthenticate.mockReturnValueOnce(promise);
    const onUnlock = jest.fn();
    const view = await renderWithStore(<LockScreen onUnlock={onUnlock} />);
    await waitFor(() => expect(mockAuthenticate).toHaveBeenCalledTimes(1));
    await view.unmount();

    await act(async () => { resolveAuthentication({ success: true }); });
    expect(onUnlock).not.toHaveBeenCalled();
  });

  it('en web advierte que no hay bloqueo y requiere continuidad explícita', async () => {
    Platform.OS = 'web';
    await renderWithStore(<ProtectedApp />);

    expect(screen.getByText('Crono web no tiene bloqueo local')).toBeTruthy();
    expect(screen.queryByText('Contenido privado')).toBeNull();
    expect(mockLevel).not.toHaveBeenCalled();
    expect(mockAuthenticate).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Continuar sin bloqueo' }));
    expect(screen.getByText('Contenido privado')).toBeTruthy();
  });
});
