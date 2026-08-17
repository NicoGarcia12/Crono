import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { EventCard } from '@/components/event-card';
import { SearchField } from '@/components/search-field';
import { EVENT_TYPE_META } from '@/constants/event-types';
import { useAppSelector } from '@/store';
import { EVENT_TYPES, type EventType } from '@/types';
import { nextOccurrence } from '@/utils/dates';
import { filterEvents } from '@/utils/search';
import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Pantalla principal: la agenda.
 * Lista todos los eventos ordenados por su PRÓXIMA ocurrencia (los anuales
 * "rotan" solos: un cumpleaños que ya pasó este año aparece para el próximo).
 */
export default function AgendaScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const router = useRouter();
  const events = useAppSelector((state) => state.events.items);
  const [filter, setFilter] = useState<EventType | 'todos'>('todos');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  // Etiquetas en uso, para ofrecerlas como filtro (no hay una lista aparte: se derivan de los eventos).
  const availableTags = useMemo(() => {
    const names = new Set<string>();
    events.forEach((event) => event.tags.forEach((tag) => names.add(tag.name)));
    return [...names].sort((a, b) => a.localeCompare(b, 'es'));
  }, [events]);

  // useMemo evita reordenar la lista en cada render — solo cuando cambia algo de esto.
  const sorted = useMemo(() => {
    const byType = filter === 'todos' ? events : events.filter((e) => e.type === filter);
    const byTag = tagFilter
      ? byType.filter((e) => e.tags.some((tag) => tag.name === tagFilter))
      : byType;
    const found = filterEvents(byTag, query);
    return [...found].sort((a, b) => nextOccurrence(a).getTime() - nextOccurrence(b).getTime());
  }, [events, filter, tagFilter, query]);

  return (
    <View style={styles.container}>
      <SearchField
        value={query}
        onChange={setQuery}
        label="Buscar eventos"
        placeholder="Buscar por nombre, tipo o descripción…"
      />

      {/* Filtros por tipo */}
      <View style={styles.filterRow}>
        <FilterChip label="Todos" active={filter === 'todos'} color={colors.contrast} onPress={() => setFilter('todos')} />
        {EVENT_TYPES.map((t) => (
          <FilterChip
            key={t}
            label={EVENT_TYPE_META[t].label}
            color={EVENT_TYPE_META[t].color}
            active={filter === t}
            onPress={() => setFilter(t)}
          />
        ))}
      </View>

      {/* Filtro por etiqueta, solo si hay alguna creada. */}
      {availableTags.length > 0 ? (
        <View style={styles.filterRow}>
          <FilterChip
            label="Todas las etiquetas"
            active={tagFilter === null}
            color={colors.contrast}
            onPress={() => setTagFilter(null)}
          />
          {availableTags.map((tag) => (
            <FilterChip
              key={tag}
              label={tag}
              color={colors.primary}
              active={tagFilter === tag}
              onPress={() => setTagFilter(tag === tagFilter ? null : tag)}
            />
          ))}
        </View>
      ) : null}

      {/* FlatList virtualiza: solo renderiza lo visible (nunca ScrollView + map para listas). */}
      <FlatList
        data={sorted}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push({ pathname: '/evento/[id]', params: { id: String(item.id) } })}>
            <EventCard event={item} />
          </Pressable>
        )}
        contentContainerStyle={sorted.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name={query ? 'search' : 'calendar-outline'} size={56} color={colors.textSubtle} />
            <Text style={styles.emptyTitle}>
              {query
                ? 'Sin resultados'
                : filter === 'todos'
                  ? 'Todavía no hay nada agendado'
                  : 'Nada agendado de este tipo'}
            </Text>
            <Text style={styles.emptyText}>
              {query
                ? `No encontramos nada que coincida con “${query}”.`
                : 'Tocá el botón + para agregar tu primer evento.'}
            </Text>
          </View>
        }
      />

      {/* FAB: botón flotante de acción, patrón clásico de mobile. */}
      <Pressable
        style={styles.fab}
        accessibilityLabel="Agregar evento"
        onPress={() => router.push('/evento/nuevo')}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </Pressable>
    </View>
  );
}

interface FilterChipProps {
  label: string;
  color: string;
  active: boolean;
  onPress: () => void;
}

function FilterChip({ label, color, active, onPress }: FilterChipProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Pressable
      style={[styles.chip, active && { backgroundColor: color, borderColor: color }]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chip: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: c.surface,
  },
  chipText: { fontSize: 12, color: c.textMuted },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  listContent: { paddingBottom: 96 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 8, padding: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: c.textMuted },
  emptyText: { fontSize: 14, color: c.textSubtle, textAlign: 'center' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: c.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
