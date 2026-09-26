import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { DateField } from '@/components/date-time-field';
import type { ContactCandidate } from '@/contacts/birthday-import';
import { todayIso } from '@/utils/dates';
import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Asistente que recorre los contactos elegidos de a uno y les pone la fecha
 * de cumpleaños. Si el contacto ya la traía de la agenda del celular, viene
 * precargada y alcanza con confirmar.
 */

export interface BirthdayWizardEntry {
  candidate: ContactCandidate;
  date: string;
  /** Nombre con el que se guarda el evento; por defecto el del contacto, pero es editable. */
  name: string;
}

interface BirthdayWizardProps {
  candidates: ContactCandidate[];
  saving?: boolean;
  /** Se llama al terminar, con la fecha y el nombre elegidos para cada contacto (los salteados no vienen). */
  onFinish: (entries: BirthdayWizardEntry[]) => void;
}

export function BirthdayWizard({ candidates, saving, onFinish }: BirthdayWizardProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [index, setIndex] = useState(0);
  const [entries, setEntries] = useState<BirthdayWizardEntry[]>([]);

  const current = candidates[index];
  const [date, setDate] = useState(current?.suggestedDate ?? todayIso());
  const [name, setName] = useState(current?.name ?? '');

  // Al pasar al siguiente contacto, precargamos su fecha (o la de hoy) y su nombre.
  useEffect(() => {
    if (current) {
      setDate(current.suggestedDate ?? todayIso());
      setName(current.name);
    }
  }, [current]);

  if (!current) return null;

  const canSave = name.trim().length > 0;

  const advance = (nextEntries: typeof entries) => {
    if (index + 1 < candidates.length) {
      setEntries(nextEntries);
      setIndex(index + 1);
    } else {
      onFinish(nextEntries);
    }
  };

  const isLast = index + 1 === candidates.length;

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>
        Contacto {index + 1} de {candidates.length}
      </Text>

      <View style={styles.card}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={28} color={colors.danger} />
        </View>
        <TextInput
          style={styles.nameInput}
          value={name}
          onChangeText={setName}
          placeholder="Nombre"
          placeholderTextColor={colors.textSubtle}
          accessibilityLabel="Nombre con el que se guarda el cumpleaños"
        />
        {current.phone ? <Text style={styles.phone}>{current.phone}</Text> : null}
      </View>

      <Text style={styles.label}>¿Cuándo cumple años?</Text>
      <DateField value={date} onChange={setDate} />
      {current.suggestedDate ? (
        <Text style={styles.hint}>
          {current.suggestedHasYear
            ? 'Fecha tomada de tus contactos.'
            : 'Tus contactos no guardan el año: revisá la fecha si querés que muestre la edad.'}
        </Text>
      ) : (
        <Text style={styles.hint}>Este contacto no tiene cumpleaños guardado en el celular.</Text>
      )}

      <View style={styles.actions}>
        <Pressable
          style={styles.skipButton}
          disabled={saving}
          accessibilityLabel="Saltear contacto"
          onPress={() => advance(entries)}
        >
          <Text style={styles.skipText}>Saltear</Text>
        </Pressable>
        <Pressable
          style={[styles.saveButton, (saving || !canSave) && styles.saveDisabled]}
          disabled={saving || !canSave}
          onPress={() => advance([...entries, { candidate: current, date, name: name.trim() }])}
        >
          <Text style={styles.saveText}>
            {saving ? 'Guardando…' : isLast ? 'Guardar y terminar' : 'Guardar y siguiente'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 10, backgroundColor: c.background },
  progress: { fontSize: 13, color: c.textSubtle, textAlign: 'center' },
  card: {
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 8,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E91E6322',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameInput: {
    fontSize: 20,
    fontWeight: '700',
    color: c.text,
    textAlign: 'center',
    minWidth: 160,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    paddingVertical: 2,
  },
  phone: { fontSize: 13, color: c.textMuted },
  label: { fontSize: 13, fontWeight: '600', color: c.textMuted },
  hint: { fontSize: 12, color: c.textSubtle, lineHeight: 17 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 'auto' },
  skipButton: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: c.border,
  },
  skipText: { color: c.textMuted, fontSize: 15, fontWeight: '600' },
  saveButton: {
    flex: 1,
    backgroundColor: c.primary,
    borderRadius: 24,
    padding: 15,
    alignItems: 'center',
  },
  saveDisabled: { opacity: 0.5 },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
