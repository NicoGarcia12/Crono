import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { confirmDestructive, errorMessage, notify } from '@/components/confirm';
import { NoteForm } from '@/components/note-form';
import { useAppDispatch, useAppSelector } from '@/store';
import { editNote, removeNote } from '@/store/notes-slice';
import type { NewNote } from '@/types';

/** Ruta dinámica /nota/[id] — editar o borrar una nota. */
export default function EditarNotaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const operation = useRef(false);
  const [busy, setBusy] = useState(false);

  const note = useAppSelector((state) => state.notes.items.find((n) => n.id === Number(id)));

  if (!note) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>Esta nota ya no existe.</Text>
      </View>
    );
  }

  const handleSubmit = async (data: NewNote): Promise<void> => {
    if (operation.current) throw new Error('Esperá a que termine la operación actual.');
    operation.current = true;
    setBusy(true);
    try {
      await dispatch(editNote({ id: note.id, data })).unwrap();
    } catch (error: unknown) {
      operation.current = false;
      setBusy(false);
      throw error;
    }
    router.back();
  };

  const confirmDelete = async (): Promise<void> => {
    if (operation.current) return;
    // Guardar y borrar comparten la traba, incluso mientras está la confirmación.
    operation.current = true;
    setBusy(true);
    let deleted = false;
    try {
      if (!(await confirmDestructive('Eliminar nota', `¿Seguro que querés eliminar "${note.title}"?`, 'Eliminar'))) {
        return;
      }
      await dispatch(removeNote(note.id)).unwrap();
      deleted = true;
      router.back();
    } catch (error: unknown) {
      notify('No se pudo eliminar la nota', `${errorMessage(error)}. La nota sigue guardada; volvé a tocar el botón de eliminar para reintentar.`);
    } finally {
      if (!deleted) {
        operation.current = false;
        setBusy(false);
      }
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => void confirmDelete()}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Eliminar nota"
              accessibilityState={{ disabled: busy, busy }}
              disabled={busy}
            >
              <Ionicons name="trash" size={22} color="#E91E63" />
            </Pressable>
          ),
        }}
      />
      <NoteForm initial={note} submitLabel="Guardar cambios" disabled={busy} onSubmit={handleSubmit} />
    </>
  );
}

const styles = StyleSheet.create({
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  missingText: { fontSize: 15, color: '#777' },
});
