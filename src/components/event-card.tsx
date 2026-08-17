import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { useEventTypeMeta } from '@/constants/use-event-types';
import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';
import type { EventItem } from '@/types';
import { formatRelative, nextOccurrence, yearsSince } from '@/utils/dates';

/**
 * Tarjeta de un evento en la lista de la agenda.
 * Presentacional en cuanto a props (todo lo del evento llega de afuera); solo
 * lee de Redux los metadatos del TIPO (label/ícono/color), que son globales.
 */
interface EventCardProps {
  event: EventItem;
  /** Día concreto a mostrar. Por defecto, la próxima ocurrencia (en el calendario ya se sabe el día). */
  occurrence?: Date;
}

export function EventCard({ event, occurrence }: EventCardProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const meta = useEventTypeMeta(event.type);
  const next = occurrence ?? nextOccurrence(event);
  const years = event.yearly ? yearsSince(event.date, next) : 0;
  // El modelo usa 1/0; este texto es una decisión de presentación local a la tarjeta.
  const title = event.isMine === 1 ? 'Mi cumpleaños' : event.title;

  return (
    <View style={styles.card}>
      {event.photoUri ? (
        <Image source={{ uri: event.photoUri }} style={styles.iconCircle} />
      ) : (
        <View style={[styles.iconCircle, { backgroundColor: `${meta.color}22` }]}>
          {/* Ionicons tipa `name` con una unión enorme de strings; casteamos desde nuestro meta. */}
          <Ionicons name={meta.icon as keyof typeof Ionicons.glyphMap} size={22} color={meta.color} />
        </View>
      )}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {meta.label}
          {event.yearly && years > 0 ? ` · ${years} años` : ''}
          {event.time ? ` · ${event.time} h` : ''}
        </Text>
        {event.tags.length > 0 ? (
          <Text style={styles.tags} numberOfLines={1}>
            {event.tags.map((tag) => tag.name).join(' · ')}
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>
        <Text style={[styles.when, { color: meta.color }]}>{formatRelative(next)}</Text>
        {event.reminders.length > 0 ? (
          <Ionicons name="notifications" size={14} color={colors.textSubtle} />
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 14,
      marginHorizontal: 16,
      marginVertical: 5,
      // Sombra multiplataforma: elevation es Android, shadow* es iOS.
      elevation: 1,
      shadowColor: c.shadow,
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
    title: { fontSize: 16, fontWeight: '600', color: c.text },
    subtitle: { fontSize: 13, color: c.textMuted },
    tags: { fontSize: 11.5, color: c.primary },
    right: { alignItems: 'flex-end', gap: 4 },
    when: { fontSize: 13, fontWeight: '600' },
  });
