import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { REMINDER_PRESETS, REMINDER_UNIT_LABELS } from '@/constants/event-types';
import { REMINDER_UNITS, type ReminderInput, type ReminderUnit } from '@/types';
import { formatReminder, reminderRank, sameReminder } from '@/utils/reminders';

/**
 * Editor de los avisos de un evento: atajos rápidos (chips) + avisos a medida
 * (número + unidad). Se pueden combinar todos los que se quieran, ej:
 * 1 mes antes, 1 semana antes, 1 día antes y 1 hora antes.
 */

interface RemindersFieldProps {
  value: ReminderInput[];
  onChange: (reminders: ReminderInput[]) => void;
}

export function RemindersField({ value, onChange }: RemindersFieldProps) {
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<ReminderUnit>('dias');

  const add = (reminder: ReminderInput) => {
    if (value.some((r) => sameReminder(r, reminder))) return; // ya está: no duplicamos
    onChange([...value, reminder].sort((a, b) => reminderRank(b) - reminderRank(a)));
  };

  const remove = (reminder: ReminderInput) => {
    onChange(value.filter((r) => !sameReminder(r, reminder)));
  };

  const parsedAmount = Number.parseInt(amount, 10);
  const canAddCustom = Number.isInteger(parsedAmount) && parsedAmount > 0;

  const addCustom = () => {
    if (!canAddCustom) return;
    add({ amount: parsedAmount, unit });
    setAmount('');
  };

  return (
    <View style={styles.container}>
      {/* Avisos ya elegidos, del más lejano al más cercano. */}
      {value.length === 0 ? (
        <Text style={styles.empty}>Sin recordatorios. Agregá los que quieras.</Text>
      ) : (
        <View style={styles.selectedList}>
          {value.map((reminder) => (
            <View key={`${reminder.amount}-${reminder.unit}`} style={styles.selectedChip}>
              <Ionicons name="notifications" size={14} color="#fff" />
              <Text style={styles.selectedText}>{formatReminder(reminder)}</Text>
              <Pressable
                accessibilityLabel={`Quitar aviso ${formatReminder(reminder)}`}
                hitSlop={8}
                onPress={() => remove(reminder)}
              >
                <Ionicons name="close" size={16} color="#fff" />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* Atajos */}
      <View style={styles.chipRow}>
        {REMINDER_PRESETS.filter((preset) => !value.some((r) => sameReminder(r, preset))).map(
          (preset) => (
            <Pressable
              key={`${preset.amount}-${preset.unit}`}
              style={styles.presetChip}
              onPress={() => add(preset)}
            >
              <Ionicons name="add" size={14} color="#208AEF" />
              <Text style={styles.presetText}>{formatReminder(preset)}</Text>
            </Pressable>
          ),
        )}
      </View>

      {/* Aviso a medida: número + unidad */}
      <View style={styles.customRow}>
        <TextInput
          style={styles.amountInput}
          accessibilityLabel="Cantidad del recordatorio"
          placeholder="2"
          placeholderTextColor="#bbb"
          keyboardType="number-pad"
          value={amount}
          onChangeText={setAmount}
          returnKeyType="done"
          onSubmitEditing={addCustom}
        />
        <View style={styles.unitRow}>
          {REMINDER_UNITS.map((u) => (
            <Pressable
              key={u}
              accessibilityLabel={REMINDER_UNIT_LABELS[u]}
              style={[styles.unitChip, u === unit && styles.unitChipActive]}
              onPress={() => setUnit(u)}
            >
              <Text style={[styles.unitText, u === unit && styles.unitTextActive]}>
                {REMINDER_UNIT_LABELS[u]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable
        style={[styles.addButton, !canAddCustom && styles.addButtonDisabled]}
        disabled={!canAddCustom}
        onPress={addCustom}
      >
        <Text style={styles.addButtonText}>Agregar recordatorio</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  empty: { fontSize: 13, color: '#999', fontStyle: 'italic' },
  selectedList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#208AEF',
    borderRadius: 20,
    paddingLeft: 12,
    paddingRight: 10,
    paddingVertical: 7,
  },
  selectedText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: '#208AEF66',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  presetText: { fontSize: 12.5, color: '#208AEF' },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  amountInput: {
    width: 64,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e2e2',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: '#1a1a2e',
    textAlign: 'center',
  },
  unitRow: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  unitChip: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 16,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: '#fff',
  },
  unitChipActive: { backgroundColor: '#1a1a2e', borderColor: '#1a1a2e' },
  unitText: { fontSize: 12, color: '#666' },
  unitTextActive: { color: '#fff', fontWeight: '600' },
  addButton: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#208AEF',
    paddingVertical: 10,
    alignItems: 'center',
  },
  addButtonDisabled: { opacity: 0.35 },
  addButtonText: { color: '#208AEF', fontSize: 14, fontWeight: '600' },
});
