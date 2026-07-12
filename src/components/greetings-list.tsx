import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { greetingsSummary, type GreetingRow } from '@/greetings/greetings';
import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Lista de "¿quién me saludó?" en mi cumpleaños, año por año.
 * Presentacional: recibe las filas ya armadas y avisa qué tocó el usuario.
 */

interface GreetingsListProps {
  year: number;
  rows: GreetingRow[];
  onChangeYear: (year: number) => void;
  onToggle: (row: GreetingRow) => void;
  /** Anotar a alguien que no está en la agenda. */
  onAddGuest: (name: string, phone: string | null) => void;
  /** Cargarle el cumpleaños al calendario a alguien anotado a mano. */
  onAddBirthday: (row: GreetingRow) => void;
  onRemoveGuest: (row: GreetingRow) => void;
}

export function GreetingsList({
  year,
  rows,
  onChangeYear,
  onToggle,
  onAddGuest,
  onAddBirthday,
  onRemoveGuest,
}: GreetingsListProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const { greeted, total } = greetingsSummary(rows);
  const canAdd = name.trim().length > 0;

  const addGuest = () => {
    if (!canAdd) return;
    onAddGuest(name.trim(), phone.trim() || null);
    setName('');
    setPhone('');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Año anterior"
          hitSlop={10}
          onPress={() => onChangeYear(year - 1)}
        >
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>¿Quién me saludó en {year}?</Text>
          <Text style={styles.summary}>
            {total === 0
              ? 'Todavía no tenés cumpleaños cargados'
              : `Te saludaron ${greeted} de ${total}`}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Año siguiente"
          hitSlop={10}
          onPress={() => onChangeYear(year + 1)}
        >
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </Pressable>
      </View>

      {rows.map((row) => (
        <View key={row.key} style={styles.row}>
          <Pressable
            style={styles.rowMain}
            accessibilityLabel={`${row.greeted ? 'Desmarcar' : 'Marcar'} saludo de ${row.name}`}
            onPress={() => onToggle(row)}
          >
            <Ionicons
              name={row.greeted ? 'checkbox' : 'square-outline'}
              size={22}
              color={row.greeted ? colors.success : colors.textSubtle}
            />
            <View style={styles.rowBody}>
              <Text style={[styles.rowName, row.greeted && styles.rowNameGreeted]} numberOfLines={1}>
                {row.name}
              </Text>
              {row.isGuest ? <Text style={styles.rowHint}>No está en tu agenda</Text> : null}
            </View>
          </Pressable>

          {/* A los anotados a mano se les puede cargar el cumpleaños o sacarlos. */}
          {row.isGuest ? (
            <View style={styles.rowActions}>
              <Pressable
                accessibilityLabel={`Agregar cumpleaños de ${row.name}`}
                hitSlop={8}
                onPress={() => onAddBirthday(row)}
              >
                <Ionicons name="calendar-outline" size={20} color={colors.primary} />
              </Pressable>
              <Pressable
                accessibilityLabel={`Sacar a ${row.name} de la lista`}
                hitSlop={8}
                onPress={() => onRemoveGuest(row)}
              >
                <Ionicons name="close" size={20} color={colors.textSubtle} />
              </Pressable>
            </View>
          ) : null}
        </View>
      ))}

      {/* Sumar a alguien que no tengo cargado */}
      <Text style={styles.addTitle}>¿Te saludó alguien que no tenés cargado?</Text>
      <View style={styles.addRow}>
        <TextInput
          style={[styles.input, styles.grow]}
          accessibilityLabel="Nombre de quien me saludó"
          placeholder="Nombre"
          placeholderTextColor={colors.textSubtle}
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={[styles.input, styles.phoneInput]}
          accessibilityLabel="Teléfono de quien me saludó"
          placeholder="Teléfono (opcional)"
          placeholderTextColor={colors.textSubtle}
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
      </View>
      <Pressable
        style={[styles.addButton, !canAdd && styles.addButtonDisabled]}
        accessibilityLabel="Sumar a la lista"
        disabled={!canAdd}
        onPress={addGuest}
      >
        <Ionicons name="add" size={16} color={colors.primary} />
        <Text style={styles.addButtonText}>Sumar a la lista</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      backgroundColor: c.surface,
      borderRadius: 14,
      marginHorizontal: 16,
      marginTop: 12,
      padding: 14,
      gap: 8,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerCenter: { flex: 1, alignItems: 'center' },
    title: { fontSize: 15.5, fontWeight: '700', color: c.text },
    summary: { fontSize: 12.5, color: c.textMuted },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
    rowBody: { flex: 1 },
    rowName: { fontSize: 15, color: c.text },
    rowNameGreeted: { color: c.success, fontWeight: '600' },
    rowHint: { fontSize: 11.5, color: c.textSubtle },
    rowActions: { flexDirection: 'row', gap: 12 },
    addTitle: { fontSize: 12.5, color: c.textMuted, marginTop: 6 },
    addRow: { flexDirection: 'row', gap: 8 },
    grow: { flex: 1 },
    phoneInput: { flex: 1 },
    input: {
      backgroundColor: c.surfaceAlt,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 14,
      color: c.text,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: 20,
      paddingVertical: 8,
    },
    addButtonDisabled: { opacity: 0.35 },
    addButtonText: { color: c.primary, fontSize: 13.5, fontWeight: '600' },
  });
