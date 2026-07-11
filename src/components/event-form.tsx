import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { EVENT_TYPE_META, REMINDER_OPTIONS } from '@/constants/event-types';
import { EVENT_TYPES, type EventItem, type EventType, type NewEvent } from '@/types';
import { dateToIso, dateToTime, formatLongDate, toLocalDate } from '@/utils/dates';

/**
 * Formulario de evento, compartido entre "crear" y "editar".
 *
 * 💡 Aprendizaje: en React Native no existe <form> como en la web; cada campo
 * es un componente controlado con useState (equivalente a un formulario
 * template-driven simple de Angular). El estado es local porque solo importa
 * mientras el formulario está abierto — a Redux llega recién al guardar.
 */

interface EventFormProps {
  /** Evento existente al editar; undefined al crear. */
  initial?: EventItem;
  submitLabel: string;
  onSubmit: (data: NewEvent) => void;
}

export function EventForm({ initial, submitLabel, onSubmit }: EventFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [type, setType] = useState<EventType>(initial?.type ?? 'evento');
  const [date, setDate] = useState(initial?.date ?? dateToIso(new Date()));
  const [time, setTime] = useState<string | null>(initial?.time ?? null);
  const [description, setDescription] = useState(initial?.description ?? '');
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(
    initial ? initial.reminderMinutes : 60 * 24,
  );
  const [yearly, setYearly] = useState<boolean>(
    initial ? initial.yearly === 1 : EVENT_TYPE_META.evento.defaultYearly,
  );
  // En Android el picker es un diálogo que se abre y cierra; este flag controla cuándo mostrarlo.
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);

  const canSave = title.trim().length > 0;

  const selectType = (t: EventType) => {
    setType(t);
    // Cambiar el tipo ajusta el default de repetición anual (editable igual).
    setYearly(EVENT_TYPE_META[t].defaultYearly);
  };

  const handleSubmit = () => {
    onSubmit({
      title: title.trim(),
      type,
      date,
      time,
      description: description.trim() || null,
      reminderMinutes,
      yearly: yearly ? 1 : 0,
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Título</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej: Cumpleaños de mamá"
        placeholderTextColor="#999"
        value={title}
        onChangeText={setTitle}
      />

      <Text style={styles.label}>Tipo</Text>
      <View style={styles.chipRow}>
        {EVENT_TYPES.map((t) => {
          const meta = EVENT_TYPE_META[t];
          const active = t === type;
          return (
            <Pressable
              key={t}
              style={[styles.chip, active && { backgroundColor: meta.color, borderColor: meta.color }]}
              onPress={() => selectType(t)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{meta.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Fecha</Text>
      <Pressable style={styles.input} onPress={() => setPicker('date')}>
        <Text style={styles.inputText}>{formatLongDate(date)}</Text>
      </Pressable>

      <Text style={styles.label}>Hora (opcional)</Text>
      <View style={styles.row}>
        <Pressable style={[styles.input, styles.grow]} onPress={() => setPicker('time')}>
          <Text style={styles.inputText}>{time ?? 'Todo el día'}</Text>
        </Pressable>
        {time ? (
          <Pressable style={styles.clearButton} onPress={() => setTime(null)}>
            <Text style={styles.clearText}>Quitar</Text>
          </Pressable>
        ) : null}
      </View>

      {picker ? (
        <DateTimePicker
          value={toLocalDate(date, time)}
          mode={picker}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_event, selected) => {
            setPicker(null); // en Android el diálogo se cierra solo; esto lo refleja en el estado
            if (!selected) return; // el usuario canceló
            if (picker === 'date') setDate(dateToIso(selected));
            else setTime(dateToTime(selected));
          }}
        />
      ) : null}

      <Text style={styles.label}>Descripción (opcional)</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Detalles, dirección, qué llevar…"
        placeholderTextColor="#999"
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <Text style={styles.label}>Recordatorio</Text>
      <View style={styles.chipRow}>
        {REMINDER_OPTIONS.map((option) => {
          const active = option.minutes === reminderMinutes;
          return (
            <Pressable
              key={option.label}
              style={[styles.chip, active && styles.chipActiveBlue]}
              onPress={() => setReminderMinutes(option.minutes)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.row, styles.switchRow]}>
        <Text style={styles.switchLabel}>Se repite todos los años</Text>
        <Switch value={yearly} onValueChange={setYearly} trackColor={{ true: '#208AEF' }} />
      </View>

      <Pressable
        style={[styles.submit, !canSave && styles.submitDisabled]}
        disabled={!canSave}
        onPress={handleSubmit}
      >
        <Text style={styles.submitText}>{submitLabel}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa' },
  content: { padding: 16, paddingBottom: 48, gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginTop: 8 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e2e2',
    borderRadius: 12,
    padding: 13,
    fontSize: 16,
    color: '#1a1a2e',
  },
  inputText: { fontSize: 16, color: '#1a1a2e' },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grow: { flex: 1 },
  clearButton: { padding: 10 },
  clearText: { color: '#E91E63', fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#fff',
  },
  chipActiveBlue: { backgroundColor: '#208AEF', borderColor: '#208AEF' },
  chipText: { fontSize: 13, color: '#555' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  switchRow: { justifyContent: 'space-between', marginTop: 12 },
  switchLabel: { fontSize: 15, color: '#1a1a2e' },
  submit: {
    backgroundColor: '#208AEF',
    borderRadius: 24,
    padding: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  submitDisabled: { opacity: 0.4 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
