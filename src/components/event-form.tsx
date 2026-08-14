import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { DateField, TimeField } from '@/components/date-time-field';
import { RemindersField } from '@/components/reminders-field';
import { EVENT_TYPE_META } from '@/constants/event-types';
import {
  EVENT_TYPES,
  type EventItem,
  type EventType,
  type NewEvent,
  type ReminderInput,
} from '@/types';
import { dateToIso } from '@/utils/dates';

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
  // Teléfono: se usa para el botón de saludar por WhatsApp.
  const [phone, setPhone] = useState(initial?.phone ?? '');
  // Varios avisos por evento, cada uno con su anticipación (cantidad + unidad).
  const [reminders, setReminders] = useState<ReminderInput[]>(
    initial
      ? initial.reminders.map(({ amount, unit }) => ({ amount, unit }))
      : [{ amount: 1, unit: 'dias' }],
  );
  const [yearly, setYearly] = useState<boolean>(
    initial ? initial.yearly === 1 : EVENT_TYPE_META.evento.defaultYearly,
  );

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
      // Si el evento vino de un contacto, conserva de quién es.
      contactId: initial?.contactId ?? null,
      phone: phone.trim() || null,
      reminders,
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
      <DateField value={date} onChange={setDate} />

      <Text style={styles.label}>Hora (opcional)</Text>
      <View style={styles.row}>
        <TimeField value={time} onChange={setTime} style={styles.grow} />
        {time ? (
          <Pressable style={styles.clearButton} onPress={() => setTime(null)}>
            <Text style={styles.clearText}>Quitar</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Solo donde tiene sentido saludar: el teléfono habilita el botón de WhatsApp. */}
      {type === 'cumpleanos' || type === 'aniversario' ? (
        <>
          <Text style={styles.label}>Teléfono (opcional, para saludar por WhatsApp)</Text>
          <TextInput
            style={styles.input}
            accessibilityLabel="Teléfono"
            placeholder="+54 9 11 5555-5555"
            placeholderTextColor="#999"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
        </>
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

      <Text style={styles.label}>Recordatorios (podés poner todos los que quieras)</Text>
      <RemindersField value={reminders} onChange={setReminders} />

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
