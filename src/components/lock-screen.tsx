import * as LocalAuthentication from 'expo-local-authentication';
import { type ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Pantalla de bloqueo.
 *
 * 💡 Aprendizaje: una app NO puede leer el PIN/contraseña del celular (el SO
 * lo prohíbe por seguridad). Lo que sí puede hacer es DELEGAR en el sistema:
 * expo-local-authentication abre el desbloqueo nativo (huella, cara o PIN,
 * el mismo que usás para desbloquear el teléfono) y solo nos dice si pasó o no.
 */

interface LockScreenProps {
  onUnlock: () => void;
}

export function LockScreen({ onUnlock }: LockScreenProps): ReactElement {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [message, setMessage] = useState<string | null>(null);
  const [authenticating, setAuthenticating] = useState(false);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const isWeb = Platform.OS === 'web';

  const authenticate = useCallback(async (): Promise<void> => {
    if (Platform.OS === 'web' || inFlightRef.current) return;
    inFlightRef.current = true;
    setAuthenticating(true);
    setMessage(null);

    try {
      // Hardware/enrollment describen sólo biometría. SECRET incluye PIN/patrón
      // del SO: no tener huella configurada nunca equivale a estar autenticado.
      const level = await LocalAuthentication.getEnrolledLevelAsync();
      if (!mountedRef.current) return;
      if (level === LocalAuthentication.SecurityLevel.NONE) {
        setMessage(
          'Configurá un PIN, patrón o contraseña en los Ajustes de seguridad de tu celular y volvé a intentar. Sin una credencial del sistema, Crono no puede habilitar el desbloqueo.',
        );
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Desbloqueá Crono',
        cancelLabel: 'Cancelar',
        // El diálogo corre en el SO, no en JS. false admite la credencial del
        // dispositivo incluso sin biometría; Crono nunca conoce ni guarda el PIN.
        disableDeviceFallback: false,
      });
      if (!mountedRef.current) return;

      if (result.success) {
        onUnlock();
      } else {
        setMessage('No se pudo verificar tu identidad. Intentá de nuevo.');
      }
    } catch {
      // Un módulo no disponible o una excepción tampoco prueban identidad.
      if (mountedRef.current) {
        setMessage('No se pudo verificar tu identidad. Intentá de nuevo.');
      }
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) setAuthenticating(false);
    }
  }, [onUnlock]);

  useEffect(() => {
    mountedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void authenticate();
    // Ignoramos respuestas tardías: un prompt nativo puede sobrevivir a esta vista.
    return () => { mountedRef.current = false; };
  }, [authenticate]);

  return (
    <View style={styles.container}>
      {/* Isotipo (la "C" del logo) en vez de un ícono genérico de candado: esta es la
          primera pantalla que se ve al abrir la app, así que refuerza la marca. */}
      <Image
        source={require('../../assets/images/branding/crono-isotipo.png')}
        style={styles.logo}
        resizeMode="contain"
        accessibilityRole="image"
        accessibilityLabel="Crono"
      />
      <Text style={styles.title}>
        {isWeb ? 'Crono web no tiene bloqueo local' : 'Crono está bloqueada'}
      </Text>
      {isWeb ? (
        <Text style={styles.message}>
          En esta versión web no se solicita el PIN, la huella ni la cara del dispositivo.
          Si continuás, cualquier persona con acceso a este navegador puede ver tus datos.
        </Text>
      ) : message ? <Text style={styles.message}>{message}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: authenticating, busy: authenticating }}
        disabled={authenticating}
        style={styles.button}
        onPress={isWeb ? onUnlock : authenticate}
      >
        <Text style={styles.buttonText}>{isWeb ? 'Continuar sin bloqueo' : 'Desbloquear'}</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
    backgroundColor: c.surface,
  },
  logo: { width: 72, height: 72 },
  title: { fontSize: 22, fontWeight: '600', color: c.text },
  message: { fontSize: 14, color: c.textMuted, textAlign: 'center' },
  button: {
    backgroundColor: c.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
