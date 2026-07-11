import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { EVENT_TYPE_META } from '@/constants/event-types';
import type { EventItem } from '@/types';
import { formatRelative, nextOccurrence, yearsSince } from '@/utils/dates';

/**
 * Tarjeta de un evento en la lista de la agenda.
 * Componente "tonto"/presentacional: recibe todo por props, no toca Redux.
 */
export function EventCard({ event }: { event: EventItem }) {
  const meta = EVENT_TYPE_META[event.type];
  const next = nextOccurrence(event);
  const years = event.yearly ? yearsSince(event.date, next) : 0;

  return (
    <View style={styles.card}>
      <View style={[styles.iconCircle, { backgroundColor: `${meta.color}22` }]}>
        {/* Ionicons tipa `name` con una unión enorme de strings; casteamos desde nuestro meta. */}
        <Ionicons name={meta.icon as keyof typeof Ionicons.glyphMap} size={22} color={meta.color} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {event.title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {meta.label}
          {event.yearly && years > 0 ? ` · ${years} años` : ''}
          {event.time ? ` · ${event.time} h` : ''}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.when, { color: meta.color }]}>{formatRelative(next)}</Text>
        {event.reminderMinutes !== null ? (
          <Ionicons name="notifications" size={14} color="#999" />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 5,
    // Sombra multiplataforma: elevation es Android, shadow* es iOS.
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '600', color: '#1a1a2e' },
  subtitle: { fontSize: 13, color: '#777' },
  right: { alignItems: 'flex-end', gap: 4 },
  when: { fontSize: 13, fontWeight: '600' },
});
