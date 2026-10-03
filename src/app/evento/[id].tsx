import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { CountdownBanner } from '@/components/countdown-banner';
import { EventForm } from '@/components/event-form';
import { GreetButton } from '@/components/greet-button';
import { useTypeCapabilities } from '@/constants/use-event-types';
import { useAppDispatch, useAppSelector } from '@/store';
import { editEvent, removeEvent } from '@/store/events-slice';
import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';
import { saveFieldValues } from '@/store/field-values-slice';
import type { FieldValues, NewEvent } from '@/types';

/**
 * Ruta dinámica /evento/[id] — editar o borrar un evento existente.
 * El [id] en el nombre del archivo funciona como :id en las rutas de Angular.
 */
export default function EditarEventoScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { id } = useLocalSearchParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const router = useRouter();

  const event = useAppSelector((state) => state.events.items.find((e) => e.id === Number(id)));
  // Antes del return temprano: los hooks no pueden depender de que el evento exista.
  const capabilities = useTypeCapabilities(event?.type ?? '');

  // Puede pasar al borrar: la pantalla sigue montada un instante sin el evento.
  if (!event) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>Este evento ya no existe.</Text>
      </View>
    );
  }

  const handleSubmit = async (data: NewEvent, fieldValues: FieldValues) => {
    await dispatch(editEvent({ id: event.id, data, previousReminders: event.reminders })).unwrap();
    // Se guardan siempre: así también se borran los que se vaciaron.
    await dispatch(saveFieldValues({ eventId: event.id, values: fieldValues })).unwrap();
    router.back();
  };

  const confirmDelete = () => {
    // Alert nativo con confirmación — borrar es destructivo, siempre se pregunta.
    Alert.alert('Eliminar evento', `¿Seguro que querés eliminar "${event.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await dispatch(removeEvent(event)).unwrap();
          router.back();
        },
      },
    ]);
  };

  return (
    <>
      {/* Botón de borrar en el header de la pantalla. */}
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={confirmDelete} hitSlop={12}>
              <Ionicons name="trash" size={22} color={colors.danger} />
            </Pressable>
          ),
        }}
      />
      <CountdownBanner event={event} />
      <GreetButton event={event} />

      {/* Ideas de regalo: solo si el tipo tiene esa capacidad. */}
      {capabilities.includes('regalos') ? (
        <Pressable
          style={styles.greetings}
          accessibilityLabel="Ver ideas de regalo"
          onPress={() => router.push({ pathname: '/regalos/[eventId]', params: { eventId: String(event.id) } })}
        >
          <Ionicons name="gift" size={20} color={colors.primary} />
          <Text style={styles.greetingsText}>Ideas de regalo</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
        </Pressable>
      ) : null}

      <EventForm initial={event} submitLabel="Guardar cambios" onSubmit={handleSubmit} />
    </>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    missing: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
    missingText: { fontSize: 15, color: c.textMuted },
    greetings: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.surface,
      borderRadius: 14,
      paddingVertical: 13,
      paddingHorizontal: 16,
      marginHorizontal: 16,
      marginTop: 12,
    },
    greetingsText: { flex: 1, fontSize: 15, fontWeight: '600', color: c.text },
  });
