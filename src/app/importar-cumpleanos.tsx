import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { BirthdayPickList } from '@/components/birthday-pick-list';
import {
  candidateToEvent,
  fetchBirthdayCandidates,
  type BirthdayCandidate,
} from '@/contacts/birthday-import';
import { store, useAppDispatch } from '@/store';
import { importBirthdayEvents } from '@/store/events-slice';

/**
 * Ruta /importar-cumpleanos — lee los contactos con fecha de nacimiento y
 * los importa como eventos de tipo cumpleaños (anuales, aviso 1 día antes).
 * El permiso de contactos se pide recién al entrar acá, no al abrir la app.
 */

type ScreenState =
  | { status: 'loading' }
  | { status: 'denied' }
  | { status: 'unavailable' }
  | { status: 'empty' }
  | { status: 'ready'; candidates: BirthdayCandidate[] };

export default function ImportarCumpleanosScreen() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [state, setState] = useState<ScreenState>({ status: 'loading' });
  const [importing, setImporting] = useState(false);

  const loadCandidates = useCallback((): (() => void) => {
    let active = true;
    setState({ status: 'loading' });
    // Los eventos se leen del store al iniciar o reintentar el permiso.
    fetchBirthdayCandidates(store.getState().events.items)
      .then((result) => {
        if (!active) return;
        if (result.status !== 'ok') setState({ status: result.status });
        else if (result.candidates.length === 0) setState({ status: 'empty' });
        else setState({ status: 'ready', candidates: result.candidates });
      })
      .catch(() => {
        if (active) setState({ status: 'unavailable' });
      });
    // Evita actualizar estado JS cuando esta vista nativa ya se desmontó.
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => loadCandidates(), [loadCandidates]);

  const handleImport = async (selected: BirthdayCandidate[]) => {
    setImporting(true);
    try {
      await dispatch(importBirthdayEvents(selected.map(candidateToEvent))).unwrap();
      router.back();
    } finally {
      setImporting(false);
    }
  };

  switch (state.status) {
    case 'loading':
      return (
        <Centered>
          <ActivityIndicator size="large" color="#208AEF" />
          <Text style={styles.message}>Buscando cumpleaños en tus contactos…</Text>
        </Centered>
      );
    case 'denied':
      return (
        <Centered icon="hand-left">
          <Text style={styles.title}>Sin permiso de contactos</Text>
          <Text style={styles.message}>
            Para importar cumpleaños, permití el acceso a contactos desde Ajustes → Apps → Crono.
            Solo se leen los nombres y las fechas de nacimiento.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reintentar acceso a contactos"
            style={styles.retryButton}
            onPress={loadCandidates}
          >
            <Text style={styles.retryText}>Reintentar</Text>
          </Pressable>
        </Centered>
      );
    case 'unavailable':
      return (
        <Centered icon="phone-portrait">
          <Text style={styles.title}>Disponible solo en el celular</Text>
          <Text style={styles.message}>
            La agenda de contactos no existe en el navegador. Abrí Crono en tu teléfono para usar
            esta función.
          </Text>
        </Centered>
      );
    case 'empty':
      return (
        <Centered icon="calendar-clear">
          <Text style={styles.title}>No encontramos cumpleaños</Text>
          <Text style={styles.message}>
            Ninguno de tus contactos tiene fecha de nacimiento cargada. Podés agregarlas desde la
            app de Contactos y volver a intentar.
          </Text>
        </Centered>
      );
    case 'ready':
      return (
        <View style={styles.container}>
          <BirthdayPickList candidates={state.candidates} importing={importing} onImport={handleImport} />
        </View>
      );
  }
}

function Centered({ icon, children }: { icon?: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  return (
    <View style={styles.centered}>
      {icon ? <Ionicons name={icon} size={56} color="#bbb" /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
    backgroundColor: '#f5f6fa',
  },
  title: { fontSize: 17, fontWeight: '600', color: '#555' },
  message: { fontSize: 14, color: '#999', textAlign: 'center', lineHeight: 20 },
  retryButton: { backgroundColor: '#208AEF', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 11 },
  retryText: { color: '#fff', fontWeight: '700' },
});
