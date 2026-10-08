import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { parseMultiValue } from '@/constants/event-bases';
import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';
import type { CustomField, FieldValues } from '@/types';

/** Un campo a completar en el evento: los de la base son obligatorios, los del tipo opcionales. */
export interface EventFieldSpec extends CustomField {
  required: boolean;
}

const NUMBER_PATTERN = /^-?\d+([.,]\d+)?$/;

/** Primer problema de los valores (para deshabilitar Guardar), o null si se puede guardar. */
export function fieldValuesProblem(specs: readonly EventFieldSpec[], values: FieldValues): string | null {
  for (const spec of specs) {
    const raw = values[spec.id] ?? '';
    const empty = spec.kind === 'multi' ? parseMultiValue(raw).length === 0 : raw.trim().length === 0;
    if (spec.required && empty) return `Completá "${spec.label}".`;
    if (spec.kind === 'numero' && !empty && !NUMBER_PATTERN.test(raw.trim())) return `"${spec.label}" tiene que ser un número.`;
  }
  return null;
}

interface CustomFieldsSectionProps {
  specs: readonly EventFieldSpec[];
  values: FieldValues;
  onChange: (values: FieldValues) => void;
}

export function CustomFieldsSection({ specs, values, onChange }: CustomFieldsSectionProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const set = (fieldId: number, value: string) => onChange({ ...values, [fieldId]: value });

  return (
    <>
      {specs.map((spec) => {
        const raw = values[spec.id] ?? '';
        const title = spec.required ? spec.label : `${spec.label} (opcional)`;

        if (spec.kind === 'select' || spec.kind === 'multi') {
          const chosen = spec.kind === 'multi' ? parseMultiValue(raw) : raw ? [raw] : [];
          const toggle = (option: string) => {
            if (spec.kind === 'select') {
              set(spec.id, chosen.includes(option) ? '' : option);
              return;
            }
            const next = chosen.includes(option) ? chosen.filter((o) => o !== option) : [...chosen, option];
            set(spec.id, JSON.stringify(next));
          };
          return (
            <View key={spec.id} style={styles.block}>
              <Text style={styles.label}>{title}</Text>
              <View style={styles.chipRow}>
                {spec.options.map((option) => {
                  const active = chosen.includes(option);
                  return (
                    <Pressable
                      key={option}
                      accessibilityLabel={`${spec.label}: ${option}`}
                      accessibilityState={{ selected: active }}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => toggle(option)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        }

        return (
          <View key={spec.id} style={styles.block}>
            <Text style={styles.label}>{title}</Text>
            <TextInput
              style={styles.input}
              accessibilityLabel={spec.label}
              keyboardType={spec.kind === 'numero' ? 'decimal-pad' : 'default'}
              placeholderTextColor={colors.textSubtle}
              value={raw}
              onChangeText={(text) => set(spec.id, text)}
            />
          </View>
        );
      })}
    </>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    block: { gap: 8 },
    label: { fontSize: 13, fontWeight: '600', color: c.textMuted, marginTop: 8 },
    input: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      padding: 13,
      fontSize: 16,
      color: c.text,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 7,
      backgroundColor: c.surface,
    },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { fontSize: 13, color: c.textMuted },
    chipTextActive: { color: '#fff', fontWeight: '600' },
  });
