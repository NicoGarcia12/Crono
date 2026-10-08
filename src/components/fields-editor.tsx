import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { parseOptionsText } from '@/constants/event-bases';
import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';
import { FIELD_KINDS, type FieldDraft, type FieldKind } from '@/types';

export const FIELD_KIND_LABELS: Record<FieldKind, string> = {
  texto: 'Texto',
  numero: 'Número',
  select: 'Una opción',
  multi: 'Varias opciones',
};

interface FieldsEditorProps {
  value: FieldDraft[];
  onChange: (fields: FieldDraft[]) => void;
  /** Mensaje del límite de 15 si ya no se puede agregar otro; null si se puede. */
  limitMessage: string | null;
  addLabel: string;
}

/**
 * Lista editable de campos personalizados. La clase de un campo se elige al
 * crearlo y después no cambia (cambiarla dejaría valores sin sentido).
 */
export function FieldsEditor({ value, onChange, limitMessage, addLabel }: FieldsEditorProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [showLimit, setShowLimit] = useState(false);

  const update = (index: number, patch: Partial<FieldDraft>) =>
    onChange(value.map((field, i) => (i === index ? { ...field, ...patch } : field)));

  const add = () => {
    if (limitMessage) {
      setShowLimit(true);
      return;
    }
    onChange([...value, { label: '', kind: 'texto', options: [] }]);
  };

  return (
    <View style={styles.container}>
      {value.map((field, index) => (
        <FieldRow
          // Los nuevos no tienen id: el índice alcanza porque solo se agregan al final.
          key={field.id ?? `nuevo-${index}`}
          field={field}
          index={index}
          onChange={(patch) => update(index, patch)}
          onRemove={() => {
            setShowLimit(false);
            onChange(value.filter((_, i) => i !== index));
          }}
        />
      ))}

      <Pressable style={styles.addButton} accessibilityLabel={addLabel} onPress={add}>
        <Ionicons name="add" size={16} color={colors.primary} />
        <Text style={styles.addText}>{addLabel}</Text>
      </Pressable>
      {showLimit && limitMessage ? <Text style={styles.limit}>{limitMessage}</Text> : null}
    </View>
  );
}

interface FieldRowProps {
  field: FieldDraft;
  index: number;
  onChange: (patch: Partial<FieldDraft>) => void;
  onRemove: () => void;
}

function FieldRow({ field, index, onChange, onRemove }: FieldRowProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // Lo tipeado se guarda aparte para que la coma final no "salte" mientras se escribe.
  const [optionsText, setOptionsText] = useState(field.options.join(', '));
  const isNew = field.id === undefined;
  const hasOptions = field.kind === 'select' || field.kind === 'multi';

  return (
    <View style={styles.field}>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.grow]}
          accessibilityLabel={`Nombre del campo ${index + 1}`}
          placeholder="Ej: Obra social, Talle, Qué llevar…"
          placeholderTextColor={colors.textSubtle}
          value={field.label}
          onChangeText={(label) => onChange({ label })}
        />
        <Pressable accessibilityLabel={`Quitar campo ${index + 1}`} hitSlop={8} onPress={onRemove}>
          <Ionicons name="trash" size={18} color={colors.danger} />
        </Pressable>
      </View>

      {isNew ? (
        <View style={styles.chipRow}>
          {FIELD_KINDS.map((kind) => {
            const active = kind === field.kind;
            return (
              <Pressable
                key={kind}
                accessibilityLabel={`Campo ${index + 1}: ${FIELD_KIND_LABELS[kind]}`}
                accessibilityState={{ selected: active }}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => onChange({ kind })}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{FIELD_KIND_LABELS[kind]}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Text style={styles.hint}>{FIELD_KIND_LABELS[field.kind]}</Text>
      )}

      {hasOptions ? (
        <TextInput
          style={styles.input}
          accessibilityLabel={`Opciones del campo ${index + 1}`}
          placeholder="Opciones separadas por coma: Torta, Bebida, Regalo"
          placeholderTextColor={colors.textSubtle}
          value={optionsText}
          onChangeText={(text) => {
            setOptionsText(text);
            onChange({ options: parseOptionsText(text) });
          }}
        />
      ) : null}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { gap: 8 },
    field: { gap: 6, backgroundColor: c.surface, borderRadius: 12, padding: 10 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    grow: { flex: 1 },
    input: {
      backgroundColor: c.background,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      padding: 10,
      fontSize: 14,
      color: c.text,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: { borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { fontSize: 12, color: c.textMuted },
    chipTextActive: { color: '#fff', fontWeight: '600' },
    hint: { fontSize: 12, color: c.textSubtle },
    addButton: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4 },
    addText: { color: c.primary, fontWeight: '600', fontSize: 13.5 },
    limit: { fontSize: 12.5, color: c.danger },
  });
