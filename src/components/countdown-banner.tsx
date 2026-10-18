import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useEventTypeMeta, useTypeCapabilities } from '@/constants/use-event-types';
import type { EventItem } from '@/types';
import { countdownLabel, dateToIso, formatLongDate, nextOccurrence, yearsToShow } from '@/utils/dates';
import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Banner de cuenta regresiva en el detalle del evento: cuántos días faltan,
 * cuándo cae y, si el tipo muestra años, la edad o los años transcurridos.
 */
export function CountdownBanner({ event }: { event: EventItem }) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const meta = useEventTypeMeta(event.type);
  const capabilities = useTypeCapabilities(event.type);
  const next = nextOccurrence(event);
  const shown = yearsToShow(event, capabilities, next);

  return (
    <View style={[styles.banner, { backgroundColor: `${meta.color}15` }]}>
      <View style={styles.row}>
        <Ionicons name="hourglass-outline" size={18} color={meta.color} />
        <Text style={[styles.countdown, { color: meta.color }]}>{countdownLabel(next)}</Text>
      </View>
      <Text style={styles.detail}>
        {formatLongDate(dateToIso(next))}
        {event.time ? ` · ${event.time} h` : ''}
        {shown?.kind === 'edad' ? ` · cumple ${shown.years}` : ''}
        {shown?.kind === 'anios' ? ` · ${shown.years} años` : ''}
      </Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  banner: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  countdown: { fontSize: 16, fontWeight: '700' },
  detail: { fontSize: 13, color: c.textMuted },
});
