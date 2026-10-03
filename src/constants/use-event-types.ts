import { useMemo } from 'react';

import { capabilityLookup, typeCapabilities } from '@/constants/event-bases';
import { FALLBACK_EVENT_TYPE_META } from '@/constants/event-types';
import { useAppSelector } from '@/store';
import type { Capability, EventBase, EventType, EventTypeMeta } from '@/types';

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

/** Base del tipo (repetición, hora obligatoria, capacidades), o undefined si no se encuentra. */
export function useEventBase(type: EventType): EventBase | undefined {
  const baseKey = useEventTypeMeta(type).baseKey;
  return useAppSelector((state) => state.eventBases.bases.find((b) => b.key === baseKey));
}

/** Capacidades efectivas del tipo: las de su base más sus extras. */
export function useTypeCapabilities(type: EventType): Capability[] {
  const meta = useEventTypeMeta(type);
  const bases = useAppSelector((state) => state.eventBases.bases);
  return useMemo(() => typeCapabilities(meta, bases), [meta, bases]);
}

/** Consultador "¿el tipo X tiene la capacidad Y?" para listas con eventos de varios tipos. */
export function useCapabilityLookup(): (typeKey: string, capability: Capability) => boolean {
  const types = useAppSelector((state) => state.eventTypes.items);
  const bases = useAppSelector((state) => state.eventBases.bases);
  return useMemo(() => capabilityLookup(types, bases), [types, bases]);
}
