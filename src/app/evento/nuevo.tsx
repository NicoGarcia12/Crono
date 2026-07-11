import { useRouter } from 'expo-router';

import { EventForm } from '@/components/event-form';
import { useAppDispatch } from '@/store';
import { addEvent } from '@/store/events-slice';
import type { NewEvent } from '@/types';

/** Ruta /evento/nuevo — crea un evento y vuelve a la agenda. */
export default function NuevoEventoScreen() {
  const dispatch = useAppDispatch();
  const router = useRouter();

  const handleSubmit = async (data: NewEvent) => {
    // unwrap() convierte el resultado del thunk en una promesa que lanza si falló.
    await dispatch(addEvent(data)).unwrap();
    router.back();
  };

  return <EventForm submitLabel="Crear evento" onSubmit={handleSubmit} />;
}
