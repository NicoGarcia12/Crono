import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { EVENT_TYPE_META } from '@/constants/event-types';
import type { EventItem } from '@/types';
import { countdownLabel, dateToIso, formatLongDate, nextOccurrence, yearsSince } from '@/utils/dates';
import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Banner de cuenta regresiva en el detalle del evento: cuántos días faltan,
 * cuándo cae y, si es cumpleaños o aniversario, cuántos años cumple.
 */
export function CountdownBanner({ event }: { event: EventItem }) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const meta = EVENT_TYPE_META[event.type];
  const next = nextOccurrence(event);
  const years = event.yearly ? yearsSince(event.date, next) : 0;

  return (
    <View style={[styles.banner, { backgroundColor: `${meta.color}15` }]}>
      <View style={styles.row}>
        <Ionicons name="hourglass-outline" size={18} color={meta.color} />
        <Text style={[styles.countdown, { color: meta.color }]}>{countdownLabel(next)}</Text>
      </View>
      <Text style={styles.detail}>
        {formatLongDate(dateToIso(next))}
        {event.time ? ` · ${event.time} h` : ''}
        {event.yearly && years > 0 ? ` · cumple ${years}` : ''}
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
