import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { EventForm } from '@/components/event-form';
import { useAppDispatch, useAppSelector } from '@/store';
import { editEvent, removeEvent } from '@/store/events-slice';
import type { NewEvent } from '@/types';

/**
 * Ruta dinámica /evento/[id] — editar o borrar un evento existente.
 * El [id] en el nombre del archivo funciona como :id en las rutas de Angular.
 */
export default function EditarEventoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const router = useRouter();

  const event = useAppSelector((state) => state.events.items.find((e) => e.id === Number(id)));

  // Puede pasar al borrar: la pantalla sigue montada un instante sin el evento.
  if (!event) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>Este evento ya no existe.</Text>
      </View>
    );
  }

  const handleSubmit = async (data: NewEvent) => {
    await dispatch(editEvent({ id: event.id, data, previousReminders: event.reminders })).unwrap();
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
              <Ionicons name="trash" size={22} color="#E91E63" />
            </Pressable>
          ),
        }}
      />
      <EventForm initial={event} submitLabel="Guardar cambios" onSubmit={handleSubmit} />
    </>
  );
}

const styles = StyleSheet.create({
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  missingText: { fontSize: 15, color: '#777' },
});
