import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { DateField } from '@/components/date-time-field';
import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';
import type { EventItem } from '@/types';
import { ageThisYear, formatLongDate, todayIso } from '@/utils/dates';

/**
 * Tarjeta "Mi cumpleaños" del perfil: se carga una sola vez acá.
 * Al guardarlo, la app crea el evento en la agenda (marcado como propio), y
 * desde el detalle de ese evento se lleva la lista de quién me saludó.
 */

interface MyBirthdayCardProps {
  /** El evento marcado como mi cumpleaños, si ya lo cargué. */
  event: EventItem | undefined;
  /**
   * Puede ser sync o async: en pantalla real guarda en Redux + SQLite.
   * En tests usamos un jest.fn() sync, por eso aceptamos ambas formas.
   */
  onSave: (isoDate: string) => void | Promise<void>;
  onOpenGreetings: () => void;
}

export function MyBirthdayCard({ event, onSave, onOpenGreetings }: MyBirthdayCardProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(event?.date ?? todayIso());

  useEffect(() => {
    // Si el padre persiste el cumpleaños y luego re-renderiza con el evento
    // definitivo, sincronizamos la fecha local para que el próximo "Editar"
    // abra con el valor guardado y no con uno viejo en memoria.
    if (event?.date) setDate(event.date);
  }, [event?.date]);

  const save = async () => {
    await onSave(date);
    setEditing(false);
  };

  const showForm = editing || !event;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        {event?.photoUri ? (
          <Image source={{ uri: event.photoUri }} style={styles.icon} />
        ) : (
          <View style={styles.icon}>
            <Ionicons name="gift" size={20} color={colors.danger} />
          </View>
        )}
        <View style={styles.headerBody}>
          <Text style={styles.title}>Mi cumpleaños</Text>
          <Text style={styles.subtitle}>
            {event
              ? `${formatLongDate(event.date)} · cumplís ${ageThisYear(event.date)} este año`
              : 'Cargalo para poder anotar quién te saluda cada año'}
          </Text>
        </View>
        {event && !editing ? (
          <Pressable accessibilityLabel="Editar mi cumpleaños" hitSlop={10} onPress={() => setEditing(true)}>
            <Ionicons name="pencil" size={16} color={colors.textSubtle} />
          </Pressable>
        ) : null}
      </View>

      {showForm ? (
        <View style={styles.form}>
          <DateField value={date} onChange={setDate} />
          <Pressable style={styles.saveButton} accessibilityLabel="Guardar mi cumpleaños" onPress={save}>
            <Text style={styles.saveText}>Guardar</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={styles.greetingsButton}
          accessibilityLabel="Ver quién me saludó"
          onPress={onOpenGreetings}
        >
          <Ionicons name="people" size={18} color={colors.primary} />
          <Text style={styles.greetingsText}>¿Quién me saludó?</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textSubtle} />
        </Pressable>
      )}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 14,
      gap: 10,
      alignSelf: 'stretch',
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    icon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: `${c.danger}22`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerBody: { flex: 1, gap: 2 },
    title: { fontSize: 15.5, fontWeight: '600', color: c.text },
    subtitle: { fontSize: 12.5, color: c.textMuted },
    form: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    saveButton: {
      backgroundColor: c.primary,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    saveText: { color: '#fff', fontWeight: '600' },
    greetingsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 20,
      paddingVertical: 9,
      paddingHorizontal: 12,
    },
    greetingsText: { flex: 1, fontSize: 14, fontWeight: '600', color: c.primary },
  });
