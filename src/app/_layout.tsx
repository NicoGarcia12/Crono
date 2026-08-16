import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { Provider } from 'react-redux';

import { LockScreen } from '@/components/lock-screen';
import { NameSetup } from '@/components/name-setup';
import { initDatabase } from '@/db/database';
import { requestNotificationPermission } from '@/notifications/notifications';
import { store, useAppSelector } from '@/store';
import { loadEvents } from '@/store/events-slice';
import { loadNotes } from '@/store/notes-slice';
import { loadSettings } from '@/store/settings-slice';
import { useTheme } from '@/theme/use-theme';

/**
 * Layout raíz de la app (Expo Router).
 *
 * 💡 Aprendizaje: en Expo Router cada archivo dentro de src/app es una ruta
 * (como el file-based routing de Next.js). `_layout.tsx` envuelve a todas las
 * rutas hijas — acá van los providers globales (Redux) y la inicialización.
 *
 * Orden de arranque:
 *  1. Abrir/migrar SQLite y cargar datos a Redux (mientras, se ve el splash).
 *  2. Pedir desbloqueo con la huella/PIN del sistema (LockScreen).
 *  3. Si es el primer uso, pedir el nombre (NameSetup).
 *  4. Mostrar la app (tabs).
 */

// Mantener el splash nativo visible hasta que la BD esté lista.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    async function bootstrap() {
      await initDatabase();
      // Cargar todo lo persistido a Redux antes de renderizar pantallas.
      await Promise.all([
        store.dispatch(loadSettings()),
        store.dispatch(loadEvents()),
        store.dispatch(loadNotes()),
      ]);
      // El permiso de notificaciones se pide una vez; si lo niega, la app funciona igual (sin avisos).
      await requestNotificationPermission();
    }

    bootstrap()
      .catch((error: unknown) => setInitError(error instanceof Error ? error.message : String(error)))
      .finally(() => {
        setReady(true);
        SplashScreen.hideAsync();
      });
  }, []);

  if (!ready) return null; // el splash nativo sigue en pantalla

  if (initError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>No se pudo iniciar Crono</Text>
        <Text style={styles.errorDetail}>{initError}</Text>
      </View>
    );
  }

  return (
    <Provider store={store}>
      <Gates />
    </Provider>
  );
}

/** Encadena bloqueo → primer uso → app. Vive dentro del Provider para poder usar Redux. */
function Gates() {
  const [unlocked, setUnlocked] = useState(false);
  const displayName = useAppSelector((state) => state.settings.displayName);
  const { name: themeName, colors } = useTheme();

  // Si la app pasa a segundo plano, se vuelve a bloquear (como una app de banco).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') setUnlocked(false);
    });
    return () => subscription.remove(); // cleanup obligatorio de listeners nativos
  }, []);

  // La barra de estado (hora, batería) necesita íconos claros sobre fondo oscuro.
  const statusBar = <StatusBar style={themeName === 'oscuro' ? 'light' : 'dark'} />;

  if (!unlocked) {
    return (
      <>
        {statusBar}
        <LockScreen onUnlock={() => setUnlocked(true)} />
      </>
    );
  }

  if (!displayName) {
    return (
      <>
        {statusBar}
        <NameSetup />
      </>
    );
  }

  return (
    <>
      {statusBar}
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="evento/nuevo" options={{ title: 'Nuevo evento', presentation: 'modal' }} />
        <Stack.Screen name="evento/[id]" options={{ title: 'Editar evento' }} />
        <Stack.Screen name="nota/nueva" options={{ title: 'Nueva nota', presentation: 'modal' }} />
        <Stack.Screen name="nota/[id]" options={{ title: 'Editar nota' }} />
        <Stack.Screen
          name="cargar-cumpleanos"
          options={{ title: 'Cargar cumpleaños', presentation: 'modal' }}
        />
        <Stack.Screen name="saludos" options={{ title: '¿Quién me saludó?' }} />
        <Stack.Screen name="regalos/[eventId]" options={{ title: 'Ideas de regalo' }} />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: '#c0392b' },
  errorDetail: { fontSize: 13, color: '#666', textAlign: 'center' },
});
