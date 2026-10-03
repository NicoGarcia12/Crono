import { useMemo, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { CAPABILITY_META, capabilityProblems } from '@/constants/event-bases';
import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';
import { CAPABILITIES, type Capability } from '@/types';

interface CapabilityTogglesProps {
  /** Las que ya vienen (ej. de la base): se ven activas y no se pueden apagar. */
  locked: readonly Capability[];
  selected: readonly Capability[];
  yearly: boolean;
  onChange: (capabilities: Capability[]) => void;
  /** Mensaje del límite de 15 si ya no entra otra; null si entra. */
  limitMessage: string | null;
}

/**
 * Interruptores de capacidades. Prender una que rompe una regla (ej. edad en
 * algo que no se repite) no se permite: se explica el motivo debajo.
 */
export function CapabilityToggles({ locked, selected, yearly, onChange, limitMessage }: CapabilityTogglesProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [message, setMessage] = useState<string | null>(null);

  const toggle = (capability: Capability, on: boolean) => {
    if (!on) {
      setMessage(null);
      onChange(selected.filter((c) => c !== capability));
      return;
    }
    if (limitMessage) {
      setMessage(limitMessage);
      return;
    }
    const current = [...locked, ...selected];
    const before = capabilityProblems(current, yearly).length;
    const after = capabilityProblems([...current, capability], yearly);
    if (after.length > before) {
      setMessage(after[after.length - 1].message);
      return;
    }
    setMessage(null);
    onChange([...selected, capability]);
  };

  return (
    <View style={styles.container}>
      {CAPABILITIES.map((capability) => {
        const isLocked = locked.includes(capability);
        const value = isLocked || selected.includes(capability);
        return (
          <View key={capability} style={styles.row}>
            <View style={styles.body}>
              <Text style={styles.label}>{CAPABILITY_META[capability].label}</Text>
              <Text style={styles.description}>
                {isLocked ? 'Viene de la base' : CAPABILITY_META[capability].description}
              </Text>
            </View>
            <Switch
              accessibilityLabel={CAPABILITY_META[capability].label}
              value={value}
              disabled={isLocked}
              onValueChange={(on) => toggle(capability, on)}
              trackColor={{ true: colors.primary }}
            />
          </View>
        );
      })}
      {message ? <Text style={styles.problem}>{message}</Text> : null}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { gap: 6 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    body: { flex: 1, gap: 1 },
    label: { fontSize: 14, color: c.text },
    description: { fontSize: 11.5, color: c.textSubtle },
    problem: { fontSize: 12.5, color: c.danger },
  });
