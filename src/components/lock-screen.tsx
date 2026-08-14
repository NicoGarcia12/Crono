import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

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

export function LockScreen({ onUnlock }: LockScreenProps) {
  const [message, setMessage] = useState<string | null>(null);

  const authenticate = useCallback(async () => {
    // En web no existe el bloqueo del sistema (huella/PIN): se deja pasar directo.
    if (Platform.OS === 'web') {
      onUnlock();
      return;
    }

    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    // Si el celular no tiene bloqueo configurado no hay nada que pedir:
    // se avisa y se deja pasar (no podemos inventar una seguridad que el SO no tiene).
    if (!hasHardware || !isEnrolled) {
      setMessage('Tu celular no tiene bloqueo configurado. Se recomienda activar uno en Ajustes.');
      onUnlock();
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Desbloqueá Crono',
      cancelLabel: 'Cancelar',
    });

    if (result.success) {
      onUnlock();
    } else {
      setMessage('No se pudo verificar tu identidad. Intentá de nuevo.');
    }
  }, [onUnlock]);

  // Pedimos el desbloqueo apenas aparece la pantalla.
  useEffect(() => {
    void authenticate();
  }, [authenticate]);

  return (
    <View style={styles.container}>
      <Ionicons name="lock-closed" size={64} color="#208AEF" />
      <Text style={styles.title}>Crono está bloqueada</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <Pressable style={styles.button} onPress={authenticate}>
        <Text style={styles.buttonText}>Desbloquear</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
    backgroundColor: '#fff',
  },
  title: { fontSize: 22, fontWeight: '600', color: '#1a1a2e' },
  message: { fontSize: 14, color: '#666', textAlign: 'center' },
  button: {
    backgroundColor: '#208AEF',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
