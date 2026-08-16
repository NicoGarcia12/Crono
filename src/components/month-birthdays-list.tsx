import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EVENT_TYPE_META } from '@/constants/event-types';
import type { EventItem } from '@/types';
import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Lista de viñetas de quién cumple años o aniversario en el mes que se está
 * mirando (calendario, vista mensual), con marca de "ya lo saludé" por
 * persona y año. Presentacional: recibe las filas ya filtradas.
 */

interface MonthBirthdaysListProps {
  people: EventItem[];
  greetedEventIds: ReadonlySet<number>;
  onToggle: (event: EventItem) => void;
}

export function MonthBirthdaysList({ people, greetedEventIds, onToggle }: MonthBirthdaysListProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (people.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cumplen este mes</Text>
      {people.map((event) => {
        const meta = EVENT_TYPE_META[event.type];
        const greeted = greetedEventIds.has(event.id);

        return (
          <Pressable
            key={event.id}
            style={styles.row}
            accessibilityLabel={`${greeted ? 'Desmarcar' : 'Marcar'} que ya saludé a ${event.title}`}
            onPress={() => onToggle(event)}
          >
            <Text style={styles.bullet}>•</Text>
            <Ionicons name={meta.icon as keyof typeof Ionicons.glyphMap} size={14} color={meta.color} />
            <Text style={[styles.name, greeted && styles.nameGreeted]} numberOfLines={1}>
              {event.title}
            </Text>
            <Ionicons
              name={greeted ? 'checkbox' : 'square-outline'}
              size={20}
              color={greeted ? colors.success : colors.textSubtle}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      backgroundColor: c.surface,
      borderRadius: 14,
      marginHorizontal: 16,
      marginTop: 12,
      padding: 14,
      gap: 8,
    },
    title: { fontSize: 15.5, fontWeight: '700', color: c.text },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
    bullet: { color: c.textSubtle, fontSize: 16 },
    name: { flex: 1, fontSize: 14.5, color: c.text },
    nameGreeted: { color: c.success, fontWeight: '600' },
  });
