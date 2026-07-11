import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { EventCard } from '@/components/event-card';
import { EVENT_TYPE_META } from '@/constants/event-types';
import { useAppSelector } from '@/store';
import { EVENT_TYPES, type EventType } from '@/types';
import { nextOccurrence } from '@/utils/dates';

/**
 * Pantalla principal: la agenda.
 * Lista todos los eventos ordenados por su PRÓXIMA ocurrencia (los anuales
 * "rotan" solos: un cumpleaños que ya pasó este año aparece para el próximo).
 */
export default function AgendaScreen() {
  const router = useRouter();
  const events = useAppSelector((state) => state.events.items);
  const [filter, setFilter] = useState<EventType | 'todos'>('todos');

  // useMemo evita reordenar la lista en cada render — solo cuando cambian eventos o filtro.
  const sorted = useMemo(() => {
    const filtered = filter === 'todos' ? events : events.filter((e) => e.type === filter);
    return [...filtered].sort((a, b) => nextOccurrence(a).getTime() - nextOccurrence(b).getTime());
  }, [events, filter]);

  return (
    <View style={styles.container}>
      {/* Filtros por tipo */}
      <View style={styles.filterRow}>
        <FilterChip label="Todos" active={filter === 'todos'} color="#1a1a2e" onPress={() => setFilter('todos')} />
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
            <Ionicons name="calendar-outline" size={56} color="#bbb" />
            <Text style={styles.emptyTitle}>
              {filter === 'todos' ? 'Todavía no hay nada agendado' : 'Nada agendado de este tipo'}
            </Text>
            <Text style={styles.emptyText}>Tocá el botón + para agregar tu primer evento.</Text>
          </View>
        }
      />

      {/* FAB: botón flotante de acción, patrón clásico de mobile. */}
      <Pressable style={styles.fab} onPress={() => router.push('/evento/nuevo')}>
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
  return (
    <Pressable
      style={[styles.chip, active && { backgroundColor: color, borderColor: color }]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa' },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: '#fff',
  },
  chipText: { fontSize: 12, color: '#555' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  listContent: { paddingBottom: 96 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 8, padding: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#555' },
  emptyText: { fontSize: 14, color: '#999', textAlign: 'center' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
