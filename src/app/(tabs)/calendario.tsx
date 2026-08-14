import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { type JSX, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { CalendarGrid } from '@/components/calendar-grid';
import { EventCard } from '@/components/event-card';
import { useAppSelector } from '@/store';
import {
  buildMonthGrid,
  buildWeek,
  eventsByDay as groupEventsByDay,
  periodLabel,
  shiftMonth,
  shiftWeek,
  type CalendarMode,
} from '@/utils/calendar';
import { capitalize, formatLongDate, todayIso, toLocalDate } from '@/utils/dates';

/**
 * Pestaña Calendario: grilla mensual o semanal, navegable hacia adelante y
 * atrás, con los eventos marcados por color según su tipo. Al tocar un día se
 * listan los eventos de ese día.
 */
export default function CalendarioScreen(): JSX.Element {
  const router = useRouter();
  const events = useAppSelector((state) => state.events.items);

  const [mode, setMode] = useState<CalendarMode>('mes');
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedIso, setSelectedIso] = useState(todayIso());

  // Las semanas visibles y los eventos de cada día se recalculan solo cuando
  // cambia el período, el modo o los eventos.
  const weeks = useMemo(
    () => (mode === 'mes' ? buildMonthGrid(anchor) : [buildWeek(anchor)]),
    [anchor, mode],
  );

  const byDay = useMemo(() => groupEventsByDay(events, weeks.flat()), [events, weeks]);

  const move = (delta: number) => {
    setAnchor((current) => (mode === 'mes' ? shiftMonth(current, delta) : shiftWeek(current, delta)));
  };

  // Al cambiar de vista, nos paramos en el día elegido (si no, la semanal
  // mostraría la semana del día 1 del mes en vez de la del día seleccionado).
  const changeMode = (next: CalendarMode) => {
    setAnchor(toLocalDate(selectedIso));
    setMode(next);
  };

  const goToday = () => {
    setAnchor(new Date());
    setSelectedIso(todayIso());
  };

  const selectedEvents = byDay.get(selectedIso) ?? [];
  const sortedSelectedEvents = useMemo(
    () => selectedEvents.slice().sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99')),
    [selectedEvents],
  );

  return (
    <View style={styles.container}>
      {/* Alternar mes / semana */}
      <View style={styles.modeRow}>
        {(['mes', 'semana'] as const).map((m) => (
          <Pressable
            key={m}
            style={[styles.modeChip, mode === m && styles.modeChipActive]}
            accessibilityLabel={m === 'mes' ? 'Vista mensual' : 'Vista semanal'}
            onPress={() => changeMode(m)}
          >
            <Text style={[styles.modeText, mode === m && styles.modeTextActive]}>
              {m === 'mes' ? 'Mes' : 'Semana'}
            </Text>
          </Pressable>
        ))}
        <Pressable style={styles.todayButton} accessibilityLabel="Ir a hoy" onPress={goToday}>
          <Text style={styles.todayText}>Hoy</Text>
        </Pressable>
      </View>

      {/* Navegación entre períodos */}
      <View style={styles.navRow}>
        <Pressable accessibilityLabel="Período anterior" hitSlop={10} onPress={() => move(-1)}>
          <Ionicons name="chevron-back" size={22} color="#208AEF" />
        </Pressable>
        <Text style={styles.period}>{capitalize(periodLabel(anchor, mode))}</Text>
        <Pressable accessibilityLabel="Período siguiente" hitSlop={10} onPress={() => move(1)}>
          <Ionicons name="chevron-forward" size={22} color="#208AEF" />
        </Pressable>
      </View>

      <CalendarGrid
        weeks={weeks}
        eventsByDay={byDay}
        currentMonth={mode === 'mes' ? anchor.getMonth() : null}
        selectedIso={selectedIso}
        onSelect={setSelectedIso}
      />

      {/* Eventos del día elegido */}
      {/* FlatList delega el montaje de celdas al renderer nativo y virtualiza la lista; JS solo entrega datos y callbacks. */}
      <FlatList
        testID="lista-virtualizada-eventos-del-dia"
        style={styles.dayList}
        contentContainerStyle={styles.dayListContent}
        data={sortedSelectedEvents}
        keyExtractor={(event) => String(event.id)}
        ListHeaderComponent={<Text style={styles.dayTitle}>{capitalize(formatLongDate(selectedIso))}</Text>}
        ListEmptyComponent={<Text style={styles.dayEmpty}>No hay nada agendado este día.</Text>}
        renderItem={({ item: event }) => (
          <Pressable onPress={() => router.push({ pathname: '/evento/[id]', params: { id: String(event.id) } })}>
            {/* La tarjeta muestra la próxima ocurrencia; en el calendario ya sabemos el día. */}
            <EventCard event={event} occurrence={toLocalDate(selectedIso, event.time)} />
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa' },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 16, paddingBottom: 6 },
  modeChip: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 5,
    backgroundColor: '#fff',
  },
  modeChipActive: { backgroundColor: '#1a1a2e', borderColor: '#1a1a2e' },
  modeText: { fontSize: 13, color: '#555' },
  modeTextActive: { color: '#fff', fontWeight: '600' },
  todayButton: { marginLeft: 'auto', paddingHorizontal: 12, paddingVertical: 5 },
  todayText: { fontSize: 13, color: '#208AEF', fontWeight: '600' },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  period: { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },
  dayList: { flex: 1, marginTop: 12 },
  dayListContent: { paddingBottom: 24 },
  dayTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#777',
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  dayEmpty: { fontSize: 14, color: '#999', paddingHorizontal: 16, paddingVertical: 8 },
});
