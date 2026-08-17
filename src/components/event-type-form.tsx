import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';
import type { EventTypeMeta, NewEventType } from '@/types';

/** Íconos y colores curados para no exponer un selector infinito. */
const ICON_OPTIONS: (keyof typeof Ionicons.glyphMap)[] = [
  'calendar', 'gift', 'heart', 'sunny', 'medkit', 'briefcase', 'school',
  'airplane', 'restaurant', 'fitness', 'home', 'paw', 'musical-notes',
  'book', 'cash', 'star',
];

const COLOR_OPTIONS = [
  '#208AEF', '#E91E63', '#9C27B0', '#FF9800', '#4CAF50',
  '#00BCD4', '#795548', '#607D8B', '#F44336', '#3F51B5',
];

interface EventTypeFormProps {
  /** Tipo existente al editar; undefined al crear uno nuevo. */
  initial?: EventTypeMeta;
  onSubmit: (data: NewEventType) => void;
  onCancel: () => void;
}

export function EventTypeForm({ initial, onSubmit, onCancel }: EventTypeFormProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [label, setLabel] = useState(initial?.label ?? '');
  const [icon, setIcon] = useState<keyof typeof Ionicons.glyphMap>(
    (initial?.icon as keyof typeof Ionicons.glyphMap) ?? ICON_OPTIONS[0],
  );
  const [color, setColor] = useState(initial?.color ?? COLOR_OPTIONS[0]);
  const [defaultYearly, setDefaultYearly] = useState(initial?.defaultYearly ?? false);

  const canSave = label.trim().length > 0;

  const submit = () => {
    if (!canSave) return;
    onSubmit({ label: label.trim(), icon, color, defaultYearly });
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        accessibilityLabel="Nombre del tipo"
        placeholder="Ej: Cumpleaños, Torneo, Mudanza…"
        placeholderTextColor={colors.textSubtle}
        value={label}
        onChangeText={setLabel}
      />

      <Text style={styles.label}>Ícono</Text>
      <View style={styles.chipRow}>
        {ICON_OPTIONS.map((option) => {
          const active = option === icon;
          return (
            <Pressable
              key={option}
              accessibilityLabel={`Ícono ${option}`}
              accessibilityState={{ selected: active }}
              style={[styles.iconChip, active && { backgroundColor: color, borderColor: color }]}
              onPress={() => setIcon(option)}
            >
              <Ionicons name={option} size={18} color={active ? '#fff' : colors.textMuted} />
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Color</Text>
      <View style={styles.chipRow}>
        {COLOR_OPTIONS.map((option) => {
          const active = option === color;
          return (
            <Pressable
              key={option}
              accessibilityLabel={`Color ${option}`}
              accessibilityState={{ selected: active }}
              style={[styles.colorChip, { backgroundColor: option }, active && styles.colorChipActive]}
              onPress={() => setColor(option)}
            />
          );
        })}
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Se repite todos los años por defecto</Text>
        <Switch value={defaultYearly} onValueChange={setDefaultYearly} trackColor={{ true: colors.primary }} />
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </Pressable>
        <Pressable
          style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
          disabled={!canSave}
          onPress={submit}
        >
          <Text style={styles.saveText}>Guardar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { gap: 10, backgroundColor: c.surfaceAlt, borderRadius: 14, padding: 14 },
    input: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      padding: 12,
      fontSize: 15,
      color: c.text,
    },
    label: { fontSize: 12.5, fontWeight: '600', color: c.textMuted },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    iconChip: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    colorChip: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    colorChipActive: { borderColor: c.text },
    switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
    switchLabel: { flex: 1, fontSize: 13.5, color: c.text, marginRight: 8 },
    actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
    cancelButton: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 20, borderWidth: 1, borderColor: c.border },
    cancelText: { color: c.textMuted, fontWeight: '600' },
    saveButton: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 20, backgroundColor: c.primary },
    saveButtonDisabled: { opacity: 0.4 },
    saveText: { color: '#fff', fontWeight: '700' },
  });
