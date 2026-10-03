import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { CapabilityToggles } from '@/components/capability-toggles';
import { FIELD_KIND_LABELS, FieldsEditor } from '@/components/fields-editor';
import {
  CAPABILITY_META,
  DEFAULT_TYPE_KEY,
  MAX_TYPE_ITEMS,
  capabilityProblems,
  fieldDraftProblem,
  itemLimitMessage,
} from '@/constants/event-bases';
import { useAppSelector } from '@/store';
import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';
import type { Capability, EventTypeMeta, FieldDraft, NewEventType } from '@/types';

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
  /** Al crear: base fija, sin poder elegir otra (ej. "crear tipo y mover los eventos"). */
  lockedBaseKey?: string;
  onSubmit: (data: NewEventType) => void;
  onCancel: () => void;
}

/**
 * Editor de un tipo de evento. Al crearlo: nombre, ícono, color, base y
 * extras. Al editarlo: solo el nombre y los extras (en los de fábrica, solo
 * el nombre). Lo de la base se muestra bloqueado.
 */
export function EventTypeForm({ initial, lockedBaseKey, onSubmit, onCancel }: EventTypeFormProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const bases = useAppSelector((state) => state.eventBases.bases);
  const allFields = useAppSelector((state) => state.eventBases.fields);

  const [label, setLabel] = useState(initial?.label ?? '');
  const [icon, setIcon] = useState<keyof typeof Ionicons.glyphMap>(
    (initial?.icon as keyof typeof Ionicons.glyphMap) ?? ICON_OPTIONS[0],
  );
  const [color, setColor] = useState(initial?.color ?? COLOR_OPTIONS[0]);
  const [baseKey, setBaseKey] = useState(initial?.baseKey ?? lockedBaseKey ?? DEFAULT_TYPE_KEY);
  const [extras, setExtras] = useState<Capability[]>(initial?.extraCapabilities ?? []);
  const [fields, setFields] = useState<FieldDraft[]>(() =>
    initial
      ? allFields
          .filter((f) => f.owner === 'type' && f.ownerId === initial.id)
          .map(({ id, label: l, kind, options }) => ({ id, label: l, kind, options }))
      : [],
  );
  const [error, setError] = useState<string | null>(null);

  const isBuiltin = initial?.isBuiltin ?? false;
  const base = bases.find((b) => b.key === baseKey);
  const baseCapabilities = base?.capabilities ?? [];
  const baseFields = base ? allFields.filter((f) => f.owner === 'base' && f.ownerId === base.id) : [];
  const yearly = base?.yearly ?? false;

  const count =
    new Set([...baseCapabilities, ...extras]).size + (base?.requiresTime ? 1 : 0) + baseFields.length + fields.length;
  const limitMessage = itemLimitMessage(count);

  /** Cambiar la base (solo al crear) descarta los extras que la base ya trae o que dejan de ser válidos. */
  const selectBase = (key: string) => {
    const next = bases.find((b) => b.key === key);
    setBaseKey(key);
    setExtras((current) => {
      const kept = current.filter((c) => !next?.capabilities.includes(c));
      const invalid = new Set(capabilityProblems([...(next?.capabilities ?? []), ...kept], next?.yearly ?? false).map((p) => p.capability));
      return kept.filter((c) => !invalid.has(c));
    });
  };

  const submit = () => {
    if (label.trim().length === 0) {
      setError('Ponele un nombre al tipo.');
      return;
    }
    const problem =
      fieldDraftProblem(fields) ??
      capabilityProblems([...baseCapabilities, ...extras], yearly)[0]?.message ??
      (count > MAX_TYPE_ITEMS ? itemLimitMessage(count - 1) : null);
    if (problem) {
      setError(problem);
      return;
    }
    onSubmit({
      label: label.trim(),
      icon,
      color,
      baseKey,
      extraCapabilities: extras.filter((c) => !baseCapabilities.includes(c)),
      fields: fields.map((f) => ({ ...f, label: f.label.trim() })),
    });
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        accessibilityLabel="Nombre del tipo"
        placeholder="Ej: Cumple de oficina, Torneo, Mudanza…"
        placeholderTextColor={colors.textSubtle}
        value={label}
        onChangeText={setLabel}
      />

      {/* Ícono y color se eligen al crear el tipo; después solo cambian el nombre y los extras. */}
      {!initial ? (
        <>
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
        </>
      ) : null}

      <Text style={styles.label}>Base</Text>
      {initial || lockedBaseKey ? (
        <Text style={styles.hint}>{base?.label ?? 'Sin base'} · la base no cambia después de crear el tipo</Text>
      ) : (
        <View style={styles.chipRow}>
          {bases.map((b) => {
            const active = b.key === baseKey;
            return (
              <Pressable
                key={b.key}
                accessibilityLabel={`Base ${b.label}`}
                accessibilityState={{ selected: active }}
                style={[styles.baseChip, active && styles.baseChipActive]}
                onPress={() => selectBase(b.key)}
              >
                <Text style={[styles.baseChipText, active && styles.baseChipTextActive]}>{b.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Lo que trae la base: bloqueado, nunca se puede quitar. */}
      <View style={styles.baseSummary}>
        <Text style={styles.summaryLine}>
          <Ionicons name="lock-closed" size={12} color={colors.textSubtle} /> Nombre y fecha
          {base?.requiresTime ? ' · hora obligatoria' : ''}
          {yearly ? ' · se repite todos los años' : ' · por única vez'}
        </Text>
        {baseCapabilities.length > 0 ? (
          <Text style={styles.summaryLine}>
            {baseCapabilities.map((c) => CAPABILITY_META[c].label).join(' · ')}
          </Text>
        ) : null}
        {baseFields.map((f) => (
          <Text key={f.id} style={styles.summaryLine}>
            {f.label} ({FIELD_KIND_LABELS[f.kind].toLowerCase()}, obligatorio)
          </Text>
        ))}
      </View>

      {isBuiltin ? (
        <Text style={styles.hint}>De un tipo de fábrica solo se cambia el nombre: para sumarle cosas, creá uno nuevo a partir de esta base.</Text>
      ) : (
        <>
          <View style={styles.extrasHeader}>
            <Text style={styles.label}>Extras</Text>
            <Text style={[styles.counter, count >= MAX_TYPE_ITEMS && { color: colors.danger }]}>
              {count} de {MAX_TYPE_ITEMS}
            </Text>
          </View>
          <CapabilityToggles
            locked={baseCapabilities}
            selected={extras}
            yearly={yearly}
            onChange={setExtras}
            limitMessage={limitMessage}
          />
          <Text style={styles.label}>Campos extra (siempre opcionales)</Text>
          <FieldsEditor value={fields} onChange={setFields} limitMessage={limitMessage} addLabel="Agregar campo" />
        </>
      )}

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
    label: { fontSize: 12.5, fontWeight: '600', color: c.textMuted },
    hint: { fontSize: 12.5, color: c.textSubtle },
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
    baseChip: { borderWidth: 1, borderColor: c.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: c.surface },
    baseChipActive: { backgroundColor: c.contrast, borderColor: c.contrast },
    baseChipText: { fontSize: 13, color: c.textMuted },
    baseChipTextActive: { color: '#fff', fontWeight: '600' },
    baseSummary: { gap: 2, backgroundColor: c.surface, borderRadius: 10, padding: 10 },
    summaryLine: { fontSize: 12.5, color: c.textMuted },
    extrasHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    counter: { fontSize: 12.5, fontWeight: '600', color: c.textMuted },
    error: { fontSize: 13, color: c.danger },
    actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
    cancelButton: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 20, borderWidth: 1, borderColor: c.border },
    cancelText: { color: c.textMuted, fontWeight: '600' },
    saveButton: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 20, backgroundColor: c.primary },
    saveText: { color: '#fff', fontWeight: '700' },
  });
