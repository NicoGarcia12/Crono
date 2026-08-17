import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';

import { GreetingsList } from '@/components/greetings-list';
import { buildGreetingRows, type GreetingRow } from '@/greetings/greetings';
import { useAppDispatch, useAppSelector } from '@/store';
import { addEvent } from '@/store/events-slice';
import {
  addGuest,
  linkGuestToEvent,
  loadGreetings,
  removeGuest,
  toggleAgendaGreeting,
  toggleGuestGreeting,
} from '@/store/greetings-slice';
import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';
import { todayIso } from '@/utils/dates';

/**
 * Ruta /saludos — quién me saludó en mi cumpleaños, año por año.
 * Se llega desde el detalle del evento marcado como "mi cumpleaños".
 */
export default function SaludosScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const dispatch = useAppDispatch();
  const router = useRouter();

  const events = useAppSelector((state) => state.events.items);
  const year = useAppSelector((state) => state.greetings.year);
  const greetings = useAppSelector((state) => state.greetings.items);

  // Al abrir (y al cambiar de año) se leen los saludos de ese año.
  useEffect(() => {
    void dispatch(loadGreetings(year));
  }, [dispatch, year]);

  const rows = useMemo(() => buildGreetingRows(events, greetings), [events, greetings]);

  const handleToggle = (row: GreetingRow) => {
    if (row.isGuest && row.greetingId !== null) {
      void dispatch(toggleGuestGreeting({ id: row.greetingId, greeted: !row.greeted }));
      return;
    }
    if (row.eventId === null) return;

    void dispatch(
      toggleAgendaGreeting({
        year,
        eventId: row.eventId,
        name: row.name,
        phone: row.phone,
        greeted: !row.greeted,
      }),
    );
  };

  /** Cargarle el cumpleaños a alguien que anoté a mano: se crea el evento y queda enlazado. */
  const handleAddBirthday = (row: GreetingRow) => {
    if (row.greetingId === null) return;

    Alert.alert(
      'Agregar cumpleaños',
      `Se va a crear el cumpleaños de ${row.name} en tu agenda (con la fecha de hoy, después la editás).`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Agregar',
          onPress: async () => {
            const created = await dispatch(
              addEvent({
                title: row.name,
                type: 'cumpleanos',
                date: todayIso(),
                time: null,
                description: null,
                contactId: null,
                phone: row.phone,
                reminders: [{ amount: 1, unit: 'dias' }],
                yearly: 1,
                isMine: 0,
                tags: [],
                photoUri: null,
              }),
            ).unwrap();

            await dispatch(linkGuestToEvent({ id: row.greetingId!, eventId: created.id })).unwrap();
            router.push({ pathname: '/evento/[id]', params: { id: String(created.id) } });
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <GreetingsList
        year={year}
        rows={rows}
        onChangeYear={(next) => void dispatch(loadGreetings(next))}
        onToggle={handleToggle}
        onAddGuest={(name, phone) => void dispatch(addGuest({ year, name, phone }))}
        onAddBirthday={handleAddBirthday}
        onRemoveGuest={(row) => {
          if (row.greetingId !== null) void dispatch(removeGuest(row.greetingId));
        }}
      />
    </ScrollView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { paddingBottom: 32 },
  });
