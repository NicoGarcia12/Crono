import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { NoteForm } from '@/components/note-form';
import { useAppDispatch, useAppSelector } from '@/store';
import { editNote, removeNote } from '@/store/notes-slice';
import type { NewNote } from '@/types';

/** Ruta dinámica /nota/[id] — editar o borrar una nota. */
export default function EditarNotaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const router = useRouter();

  const note = useAppSelector((state) => state.notes.items.find((n) => n.id === Number(id)));

  if (!note) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>Esta nota ya no existe.</Text>
      </View>
    );
  }

  const handleSubmit = async (data: NewNote) => {
    await dispatch(editNote({ id: note.id, data })).unwrap();
    router.back();
  };

  const confirmDelete = () => {
    Alert.alert('Eliminar nota', `¿Seguro que querés eliminar "${note.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await dispatch(removeNote(note.id)).unwrap();
          router.back();
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={confirmDelete} hitSlop={12}>
              <Ionicons name="trash" size={22} color="#E91E63" />
            </Pressable>
          ),
        }}
      />
      <NoteForm initial={note} submitLabel="Guardar cambios" onSubmit={handleSubmit} />
    </>
  );
}

const styles = StyleSheet.create({
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  missingText: { fontSize: 15, color: '#777' },
});
