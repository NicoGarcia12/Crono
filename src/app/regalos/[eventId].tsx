import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { GiftIdeasList } from '@/components/gift-ideas-list';
import { useAppDispatch, useAppSelector } from '@/store';
import { addGiftIdea, editGiftIdea, loadGiftIdeas, removeGiftIdea } from '@/store/gift-ideas-slice';
import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';
import type { GiftIdea } from '@/types';

/**
 * Ruta /regalos/[eventId] — ideas de regalo de la persona de ese evento.
 * Se llega desde el detalle del evento (cumpleaños, aniversario, etc.).
 */
export default function RegalosScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const id = Number(eventId);
  const dispatch = useAppDispatch();

  const event = useAppSelector((state) => state.events.items.find((e) => e.id === id));
  const items = useAppSelector((state) => (state.giftIdeas.eventId === id ? state.giftIdeas.items : []));

  useEffect(() => {
    void dispatch(loadGiftIdeas(id));
  }, [dispatch, id]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {event ? <Text style={styles.subtitle}>Para {event.title}</Text> : null}
      <GiftIdeasList
        items={items}
        onAdd={(text) => void dispatch(addGiftIdea({ eventId: id, text }))}
        onEdit={(giftId, text) => void dispatch(editGiftIdea({ id: giftId, text }))}
        onGiven={(item: GiftIdea) => void dispatch(removeGiftIdea(item.id))}
      />
    </ScrollView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { paddingBottom: 32 },
    subtitle: { fontSize: 13, color: c.textMuted, textAlign: 'center', marginTop: 14 },
  });
