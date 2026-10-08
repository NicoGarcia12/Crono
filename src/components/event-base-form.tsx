import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { CapabilityToggles } from '@/components/capability-toggles';
import { FieldsEditor } from '@/components/fields-editor';
import { MAX_TYPE_ITEMS, capabilityProblems, fieldDraftProblem, itemLimitMessage } from '@/constants/event-bases';
import { useAppSelector } from '@/store';
import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';
import type { Capability, EventBase, FieldDraft, NewEventBase } from '@/types';

interface EventBaseFormProps {
  /** Base propia existente al editar; undefined al crear. */
  initial?: EventBase;
  onSubmit: (data: NewEventBase) => void;
  onCancel: () => void;
}

/**
 * Editor de una base propia: nombre, repetición y hora obligatoria (solo al
 * crearla), capacidades y campos obligatorios. Todo lo que tenga la base lo
 * heredan, bloqueado, los tipos que salgan de ella.
 */
export function EventBaseForm({ initial, onSubmit, onCancel }: EventBaseFormProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const allFields = useAppSelector((state) => state.eventBases.fields);

  const [label, setLabel] = useState(initial?.label ?? '');
  const [yearly, setYearly] = useState(initial?.yearly ?? false);
  const [requiresTime, setRequiresTime] = useState(initial?.requiresTime ?? false);
  const [capabilities, setCapabilities] = useState<Capability[]>(initial?.capabilities ?? []);
  const [fields, setFields] = useState<FieldDraft[]>(() =>
    initial
      ? allFields
          .filter((f) => f.owner === 'base' && f.ownerId === initial.id)
          .map(({ id, label: l, kind, options }) => ({ id, label: l, kind, options }))
      : [],
  );
  const [error, setError] = useState<string | null>(null);

  const count = capabilities.length + (requiresTime ? 1 : 0) + fields.length;
  const limitMessage = itemLimitMessage(count);

  /** Dejar de repetir anula las capacidades que lo necesitan (edad, años, "¿ya lo saludé?"). */
  const changeYearly = (value: boolean) => {
    setYearly(value);
    if (!value) {
      const invalid = new Set(capabilityProblems(capabilities, false).map((p) => p.capability));
      setCapabilities((current) => current.filter((c) => !invalid.has(c)));
    }
  };

  const submit = () => {
    if (label.trim().length === 0) {
      setError('Ponele un nombre a la base.');
      return;
    }
    const problem = fieldDraftProblem(fields) ?? capabilityProblems(capabilities, yearly)[0]?.message ?? null;
    if (problem) {
      setError(problem);
      return;
    }
    onSubmit({
      label: label.trim(),
      yearly,
      requiresTime,
      capabilities,
      fields: fields.map((f) => ({ ...f, label: f.label.trim() })),
    });
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        accessibilityLabel="Nombre de la base"
        placeholder="Ej: Mascota, Trámite, Partido…"
        placeholderTextColor={colors.textSubtle}
        value={label}
        onChangeText={setLabel}
      />

      {initial ? (
        <Text style={styles.hint}>
          {initial.yearly ? 'Se repite todos los años' : 'Por única vez'}
          {initial.requiresTime ? ' · hora obligatoria' : ''} · no cambia después de crearla
        </Text>
      ) : (
        <>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Se repite todos los años</Text>
            <Switch accessibilityLabel="Se repite todos los años" value={yearly} onValueChange={changeYearly} trackColor={{ true: colors.primary }} />
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>La hora es obligatoria</Text>
            <Switch
              accessibilityLabel="La hora es obligatoria"
              value={requiresTime}
              onValueChange={(value) => {
                if (value && limitMessage) {
                  setError(limitMessage);
                  return;
                }
                setRequiresTime(value);
              }}
              trackColor={{ true: colors.primary }}
            />
          </View>
        </>
      )}

      <View style={styles.header}>
        <Text style={styles.label}>Capacidades</Text>
        <Text style={[styles.counter, count >= MAX_TYPE_ITEMS && { color: colors.danger }]}>
          {count} de {MAX_TYPE_ITEMS}
        </Text>
      </View>
      <CapabilityToggles
        locked={[]}
        selected={capabilities}
        yearly={yearly}
        onChange={setCapabilities}
        limitMessage={limitMessage}
      />

      <Text style={styles.label}>Campos obligatorios</Text>
      <FieldsEditor value={fields} onChange={setFields} limitMessage={limitMessage} addLabel="Agregar campo obligatorio" />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </Pressable>
        <Pressable style={styles.saveButton} onPress={submit}>
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
    hint: { fontSize: 12.5, color: c.textSubtle },
    switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    switchLabel: { flex: 1, fontSize: 13.5, color: c.text, marginRight: 8 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    label: { fontSize: 12.5, fontWeight: '600', color: c.textMuted },
    counter: { fontSize: 12.5, fontWeight: '600', color: c.textMuted },
    error: { fontSize: 13, color: c.danger },
    actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
    cancelButton: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 20, borderWidth: 1, borderColor: c.border },
    cancelText: { color: c.textMuted, fontWeight: '600' },
    saveButton: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 20, backgroundColor: c.primary },
    saveText: { color: '#fff', fontWeight: '700' },
  });
