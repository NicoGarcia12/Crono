import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { DateField, TimeField } from '@/components/date-time-field';
import { PhotoPicker } from '@/components/photo-picker';
import { RemindersField } from '@/components/reminders-field';
import { TagsField } from '@/components/tags-field';
import { useEventTypeMeta, useEventTypesList } from '@/constants/use-event-types';
import type { EventItem, EventType, NewEvent, ReminderInput } from '@/types';
import { ageThisYear, dateToIso, dateWithAgeThisYear } from '@/utils/dates';
import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';

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
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const eventTypes = useEventTypesList();
  const defaultTypeMeta = useEventTypeMeta('evento');

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
    initial ? initial.yearly === 1 : defaultTypeMeta.defaultYearly,
  );
  const [tags, setTags] = useState<string[]>(initial?.tags.map((tag) => tag.name) ?? []);
  const [photoUri, setPhotoUri] = useState<string | null>(initial?.photoUri ?? null);
  // Edad que cumple este año: se deriva de la fecha, y al escribirla cambia la fecha.
  const [ageText, setAgeText] = useState(() => String(ageThisYear(initial?.date ?? dateToIso(new Date()))));

  const canSave = title.trim().length > 0;

  const isBirthday = type === 'cumpleanos';
  const isMine = initial?.isMine === 1;
  const canGreetType = isBirthday || type === 'aniversario';

  const selectType = (t: EventType) => {
    if (isMine) return; // La UI no ofrece una acción que viole el invariante.
    setType(t);
    // Cambiar el tipo ajusta el default de repetición anual (editable igual).
    setYearly(eventTypes.find((et) => et.key === t)?.defaultYearly ?? false);
  };

  /**
   * Escribir la edad que cumple este año fija el año de nacimiento (día y mes
   * no cambian). Se guarda también lo tipeado para poder borrar el campo sin
   * que "salte" solo mientras se escribe.
   */
  const handleAgeChange = (value: string) => {
    setAgeText(value);
    const age = Number.parseInt(value, 10);
    if (!Number.isInteger(age) || age < 0 || age > 130) return;
    setDate(dateWithAgeThisYear(date, age));
  };

  /** Al elegir la fecha, la edad mostrada se recalcula sola. */
  const handleDateChange = (isoDate: string) => {
    setDate(isoDate);
    setAgeText(String(ageThisYear(isoDate)));
  };

  const handleSubmit = () => {
    onSubmit({
      title: title.trim(),
      type: isMine ? 'cumpleanos' : type,
      date,
      time,
      description: description.trim() || null,
      // Si el evento vino de un contacto, conserva de quién es.
      contactId: initial?.contactId ?? null,
      phone: phone.trim() || null,
      reminders,
      yearly: isMine ? 1 : yearly ? 1 : 0,
      // Mi cumpleaños se marca desde el perfil, no acá: al editar se conserva.
      isMine: initial?.isMine ?? 0,
      tags,
      photoUri,
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <PhotoPicker
        uri={photoUri}
        onChange={setPhotoUri}
        filePrefix="evento"
        accessibilityLabel="Elegir foto del evento"
      />

      <Text style={styles.label}>Título</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej: Cumpleaños de mamá"
        placeholderTextColor={colors.textSubtle}
        value={title}
        onChangeText={setTitle}
      />

      <Text style={styles.label}>Tipo</Text>
      <View style={styles.chipRow}>
        {eventTypes.map((meta) => {
          const active = meta.key === type;
          return (
            <Pressable
              key={meta.key}
              style={[styles.chip, active && { backgroundColor: meta.color, borderColor: meta.color }]}
              disabled={isMine}
              onPress={() => selectType(meta.key)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{meta.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Fecha</Text>
      <DateField value={date} onChange={handleDateChange} />

      <Text style={styles.label}>Hora (opcional)</Text>
      <View style={styles.row}>
        <TimeField value={time} onChange={setTime} style={styles.grow} />
        {time ? (
          <Pressable style={styles.clearButton} onPress={() => setTime(null)}>
            <Text style={styles.clearText}>Quitar</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Edad: se puede cargar en vez del año de nacimiento (útil si no lo sabés). */}
      {canGreetType ? (
        <>
          <Text style={styles.label}>
            {isBirthday ? 'Cumple este año (opcional)' : 'Cumplen este año (opcional)'}
          </Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.ageInput]}
              accessibilityLabel="Edad que cumple este año"
              placeholder="30"
              placeholderTextColor={colors.textSubtle}
              keyboardType="number-pad"
              value={ageText}
              onChangeText={handleAgeChange}
            />
            <Text style={styles.ageHint}>
              {`años en ${new Date().getFullYear()} · nació en ${date.slice(0, 4)}`}
            </Text>
          </View>
        </>
      ) : null}

      {/* Solo donde tiene sentido saludar: el teléfono habilita el botón de WhatsApp. */}
      {canGreetType ? (
        <>
          <Text style={styles.label}>Teléfono (opcional, para saludar por WhatsApp)</Text>
          <TextInput
            style={styles.input}
            accessibilityLabel="Teléfono"
            placeholder="+54 9 11 5555-5555"
            placeholderTextColor={colors.textSubtle}
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
        placeholderTextColor={colors.textSubtle}
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <Text style={styles.label}>Recordatorios (podés poner todos los que quieras)</Text>
      <RemindersField value={reminders} onChange={setReminders} />

      <Text style={styles.label}>Etiquetas (opcional)</Text>
      <TagsField value={tags} onChange={setTags} />

      <View style={[styles.row, styles.switchRow]}>
        <Text style={styles.switchLabel}>Se repite todos los años</Text>
        <Switch value={isMine ? true : yearly} disabled={isMine} onValueChange={setYearly} trackColor={{ true: colors.primary }} />
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

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: 16, paddingBottom: 48, gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: c.textMuted, marginTop: 8 },
  ageInput: { width: 80, textAlign: 'center' },
  ageHint: { flex: 1, fontSize: 13, color: c.textSubtle },
  mineLabel: { flex: 1, gap: 2 },
  mineHint: { fontSize: 12, color: c.textSubtle },
  input: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    padding: 13,
    fontSize: 16,
    color: c.text,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grow: { flex: 1 },
  clearButton: { padding: 10 },
  clearText: { color: c.danger, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: c.surface,
  },
  chipActiveBlue: { backgroundColor: c.primary, borderColor: c.primary },
  chipText: { fontSize: 13, color: c.textMuted },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  switchRow: { justifyContent: 'space-between', marginTop: 12 },
  switchLabel: { fontSize: 15, color: c.text },
  submit: {
    backgroundColor: c.primary,
    borderRadius: 24,
    padding: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  submitDisabled: { opacity: 0.4 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
