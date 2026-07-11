import { useRouter } from 'expo-router';

import { NoteForm } from '@/components/note-form';
import { useAppDispatch } from '@/store';
import { addNote } from '@/store/notes-slice';
import type { NewNote } from '@/types';

/** Ruta /nota/nueva — crea una nota personal. */
export default function NuevaNotaScreen() {
  const dispatch = useAppDispatch();
  const router = useRouter();

  const handleSubmit = async (data: NewNote) => {
    await dispatch(addNote(data)).unwrap();
    router.back();
  };

  return <NoteForm submitLabel="Guardar nota" onSubmit={handleSubmit} />;
}
