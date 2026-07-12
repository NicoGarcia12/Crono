import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { EVENT_TYPE_META } from '@/constants/event-types';
import type { EventItem } from '@/types';
import { WEEKDAY_INITIALS } from '@/utils/calendar';
import { dateToIso, todayIso } from '@/utils/dates';
import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Grilla del calendario (presentacional): recibe las semanas ya calculadas y
 * los eventos agrupados por día. Cada día muestra un puntito por cada TIPO de
 * evento que cae ahí, con su color.
 */

interface CalendarGridProps {
  weeks: Date[][];
  eventsByDay: Map<string, EventItem[]>;
  /** Mes que se está mirando (los días de otros meses se ven apagados). Null en vista semanal. */
  currentMonth: number | null;
  selectedIso: string;
  onSelect: (iso: string) => void;
}

export function CalendarGrid({
  weeks,
  eventsByDay,
  currentMonth,
  selectedIso,
  onSelect,
}: CalendarGridProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const today = todayIso();

  return (
    <View style={styles.container}>
      <View style={styles.weekdayRow}>
        {WEEKDAY_INITIALS.map((initial, index) => (
          <Text key={index} style={styles.weekday}>
            {initial}
          </Text>
        ))}
      </View>

      {weeks.map((week, weekIndex) => (
        <View key={weekIndex} style={styles.week}>
          {week.map((day) => {
            const iso = dateToIso(day);
            const dayEvents = eventsByDay.get(iso) ?? [];
            const isSelected = iso === selectedIso;
            const isToday = iso === today;
            const isOutside = currentMonth !== null && day.getMonth() !== currentMonth;

            // Un puntito por tipo (no por evento) para no saturar el día.
            const types = [...new Set(dayEvents.map((e) => e.type))].slice(0, 4);

            return (
              <Pressable
                key={iso}
                style={styles.day}
                accessibilityLabel={`Día ${iso}`}
                onPress={() => onSelect(iso)}
              >
                <View style={[styles.dayCircle, isToday && styles.today, isSelected && styles.selected]}>
                  <Text
                    style={[
                      styles.dayNumber,
                      isOutside && styles.dayOutside,
                      (isSelected || isToday) && styles.dayNumberHighlighted,
                    ]}
                  >
                    {day.getDate()}
                  </Text>
                </View>
                <View style={styles.dots}>
                  {types.map((type) => (
                    <View key={type} style={[styles.dot, { backgroundColor: EVENT_TYPE_META[type].color }]} />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  container: { backgroundColor: c.surface, borderRadius: 16, padding: 8, marginHorizontal: 16 },
  weekdayRow: { flexDirection: 'row', paddingBottom: 6 },
  weekday: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: c.textSubtle },
  week: { flexDirection: 'row' },
  day: { flex: 1, alignItems: 'center', paddingVertical: 3, gap: 2 },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  today: { backgroundColor: '#208AEF22' },
  selected: { backgroundColor: c.primary },
  dayNumber: { fontSize: 14, color: c.text },
  dayNumberHighlighted: { fontWeight: '700' },
  dayOutside: { color: '#ccc' },
  dots: { flexDirection: 'row', gap: 2, height: 6 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
});
