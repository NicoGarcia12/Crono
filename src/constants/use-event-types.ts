import { FALLBACK_EVENT_TYPE_META } from '@/constants/event-types';
import { useAppSelector } from '@/store';
import type { EventType, EventTypeMeta } from '@/types';

/** Metadatos (label/ícono/color) del tipo de un evento, ya resueltos desde la BD. */
export function useEventTypeMeta(type: EventType): EventTypeMeta {
  return useAppSelector(
    (state) => state.eventTypes.items.find((t) => t.key === type) ?? FALLBACK_EVENT_TYPE_META,
  );
}

/** Todos los tipos disponibles, para chips de selección/filtro. */
export function useEventTypesList(): EventTypeMeta[] {
  return useAppSelector((state) => state.eventTypes.items);
}
