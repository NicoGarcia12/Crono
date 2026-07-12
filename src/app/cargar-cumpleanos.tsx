import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { BirthdayWizard } from '@/components/birthday-wizard';
import { ContactPickList } from '@/components/contact-pick-list';
import { candidateToEvent, fetchContacts, type ContactCandidate } from '@/contacts/birthday-import';
import { store, useAppDispatch } from '@/store';
import { addEvent, removeEvent } from '@/store/events-slice';
import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Ruta /cargar-cumpleanos — muestra todos los contactos del celular, se eligen
 * los que se quieren cargar y se les pone la fecha de a uno.
 * El permiso de contactos se pide recién al entrar acá, no al abrir la app.
 */

type ScreenState =
  | { status: 'loading' }
  | { status: 'denied' }
  | { status: 'unavailable' }
  | { status: 'empty' }
  | { status: 'list'; candidates: ContactCandidate[] }
  | { status: 'wizard'; candidates: ContactCandidate[]; selected: ContactCandidate[] };

export default function CargarCumpleanosScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const dispatch = useAppDispatch();
  const router = useRouter();
  const [state, setState] = useState<ScreenState>({ status: 'loading' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    // Los eventos se leen del store (ya cargados al abrir la app).
    const result = await fetchContacts(store.getState().events.items);
    if (result.status !== 'ok') setState({ status: result.status });
    else if (result.candidates.length === 0) setState({ status: 'empty' });
    else setState({ status: 'list', candidates: result.candidates });
  }, []);

  useEffect(() => {
    load().catch(() => setState({ status: 'unavailable' }));
  }, [load]);

  const handleDelete = (candidate: ContactCandidate) => {
    const loaded = candidate.loaded;
    if (!loaded) return;

    Alert.alert('Borrar cumpleaños', `¿Sacar el cumpleaños de ${candidate.name} de tu agenda?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          const event = store.getState().events.items.find((e) => e.id === loaded.eventId);
          if (event) await dispatch(removeEvent(event)).unwrap();
          await load(); // la lista se rearma: el contacto vuelve a estar disponible
        },
      },
    ]);
  };

  const handleSave = async (entries: { candidate: ContactCandidate; date: string }[]) => {
    setSaving(true);
    try {
      // Secuencial a propósito: SQLite escribe de a una y son pocos registros.
      for (const { candidate, date } of entries) {
        await dispatch(addEvent(candidateToEvent(candidate, date))).unwrap();
      }
      router.back();
    } finally {
      setSaving(false);
    }
  };

  switch (state.status) {
    case 'loading':
      return (
        <Centered>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.message}>Leyendo tus contactos…</Text>
        </Centered>
      );
    case 'denied':
      return (
        <Centered icon="hand-left">
          <Text style={styles.title}>Sin permiso de contactos</Text>
          <Text style={styles.message}>
            Para cargar cumpleaños, permití el acceso a contactos desde Ajustes → Apps → Crono.
            Solo se leen los nombres, teléfonos y fechas de nacimiento.
          </Text>
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
        <Centered icon="people">
          <Text style={styles.title}>No tenés contactos</Text>
          <Text style={styles.message}>
            Cuando agregues contactos al celular vas a poder cargarles el cumpleaños desde acá.
          </Text>
        </Centered>
      );
    case 'list':
      return (
        <View style={styles.container}>
          <ContactPickList
            candidates={state.candidates}
            onDelete={handleDelete}
            onContinue={(selected) =>
              setState({ status: 'wizard', candidates: state.candidates, selected })
            }
          />
        </View>
      );
    case 'wizard':
      return (
        <View style={styles.container}>
          <BirthdayWizard candidates={state.selected} saving={saving} onFinish={handleSave} />
        </View>
      );
  }
}

function Centered({ icon, children }: { icon?: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.centered}>
      {icon ? <Ionicons name={icon} size={56} color={colors.textSubtle} /> : null}
      {children}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
    backgroundColor: c.background,
  },
  title: { fontSize: 17, fontWeight: '600', color: c.textMuted },
  message: { fontSize: 14, color: c.textSubtle, textAlign: 'center', lineHeight: 20 },
});
