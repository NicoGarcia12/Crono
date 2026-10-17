import { useMemo, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { CAPABILITY_META, capabilityProblems, unavailableCapabilities } from '@/constants/event-bases';
import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';
import { CAPABILITIES, type Capability } from '@/types';

interface CapabilityTogglesProps {
  /** Las que ya vienen (ej. de la base): no se listan acá, se muestran aparte como incluidas. */
  locked: readonly Capability[];
  selected: readonly Capability[];
  yearly: boolean;
  /** Dónde se usa: cambia la recomendación de las que no se pueden sumar. */
  where: 'tipo' | 'base';
  onChange: (capabilities: Capability[]) => void;
  /** Mensaje del límite de 15 si ya no entra otra; null si entra. */
  limitMessage: string | null;
}

/**
 * Interruptores de las funciones que se pueden sumar. Las que no tienen
 * sentido con lo fijo (ej. edad en algo que no se repite) directamente no
 * aparecen: una línea al final explica por qué y qué base conviene. Si prender
 * una choca con otra prendida, el motivo sale debajo de ese interruptor.
 */
export function CapabilityToggles({ locked, selected, yearly, where, onChange, limitMessage }: CapabilityTogglesProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [message, setMessage] = useState<{ capability: Capability; text: string } | null>(null);

  const { hidden, hint } = unavailableCapabilities(locked, yearly, where);
  const visible = CAPABILITIES.filter((c) => !locked.includes(c) && !hidden.includes(c));

  const toggle = (capability: Capability, on: boolean) => {
    if (!on) {
      setMessage(null);
      onChange(selected.filter((c) => c !== capability));
      return;
    }
    if (limitMessage) {
      setMessage({ capability, text: limitMessage });
      return;
    }
    const current = [...locked, ...selected];
    const before = capabilityProblems(current, yearly).length;
    const after = capabilityProblems([...current, capability], yearly);
    if (after.length > before) {
      setMessage({ capability, text: after[after.length - 1].message });
      return;
    }
    setMessage(null);
    onChange([...selected, capability]);
  };

  return (
    <View style={styles.container}>
      {visible.map((capability) => (
        <View key={capability}>
          <View style={styles.row}>
            <View style={styles.body}>
              <Text style={styles.label}>{CAPABILITY_META[capability].label}</Text>
              <Text style={styles.description}>{CAPABILITY_META[capability].description}</Text>
            </View>
            <Switch
              accessibilityLabel={CAPABILITY_META[capability].label}
              value={selected.includes(capability)}
              onValueChange={(on) => toggle(capability, on)}
              trackColor={{ true: colors.primary }}
            />
          </View>
          {message?.capability === capability ? <Text style={styles.problem}>{message.text}</Text> : null}
        </View>
      ))}
      {visible.length === 0 ? <Text style={styles.description}>No hay más funciones para sumar.</Text> : null}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
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
    hint: { fontSize: 12, color: c.textMuted, fontStyle: 'italic', marginTop: 2 },
    problem: { fontSize: 12.5, color: c.danger, marginTop: 2 },
  });
