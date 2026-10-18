import { useRouter } from 'expo-router';

import { EventForm } from '@/components/event-form';
import { useAppDispatch } from '@/store';
import { addEvent } from '@/store/events-slice';
import { saveFieldValues } from '@/store/field-values-slice';
import type { FieldValues, NewEvent } from '@/types';

/** Ruta /evento/nuevo — crea un evento y vuelve a la agenda. */
export default function NuevoEventoScreen() {
  const dispatch = useAppDispatch();
  const router = useRouter();

  const handleSubmit = async (data: NewEvent, fieldValues: FieldValues) => {
    // unwrap() convierte el resultado del thunk en una promesa que lanza si falló.
    const created = await dispatch(addEvent(data)).unwrap();
    if (Object.keys(fieldValues).length > 0) {
      await dispatch(saveFieldValues({ eventId: created.id, values: fieldValues })).unwrap();
    }
    router.back();
  };

  return <EventForm submitLabel="Crear evento" onSubmit={handleSubmit} />;
}
