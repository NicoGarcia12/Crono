import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';

import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';

interface TagPillProps {
  label: string;
  /** 'fuerte' para lo que no se puede quitar (obligatorio, incluido); 'suave' para lo opcional. */
  tone?: 'fuerte' | 'suave';
}

/** Etiqueta chica al lado de un ítem: "Obligatorio", "Opcional", "Incluida"… */
export function TagPill({ label, tone = 'suave' }: TagPillProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <Text style={[styles.pill, tone === 'fuerte' && styles.strong]}>{label}</Text>;
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    pill: {
      fontSize: 11,
      fontWeight: '600',
      color: c.textMuted,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: 6,
      paddingVertical: 1,
      overflow: 'hidden',
    },
    strong: { color: '#fff', backgroundColor: c.contrast, borderColor: c.contrast },
  });
