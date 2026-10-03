import { useMemo } from 'react';

import type { EventFieldSpec } from '@/components/custom-fields-section';
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

/** Los tipos que se pueden elegir (chips de selección/filtro): sin los ocultos, como "Mi cumpleaños". */
export function useEventTypesList(): EventTypeMeta[] {
  const items = useAppSelector((state) => state.eventTypes.items);
  return useMemo(() => items.filter((t) => !t.hidden), [items]);
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

/**
 * Campos personalizados a completar en un evento de este tipo: primero los
 * de la base (obligatorios) y después los extras del tipo (opcionales).
 */
export function useEventFieldSpecs(type: EventType): EventFieldSpec[] {
  const meta = useEventTypeMeta(type);
  const base = useEventBase(type);
  const fields = useAppSelector((state) => state.eventBases.fields);
  return useMemo(() => {
    const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;
    const baseFields = base ? fields.filter((f) => f.owner === 'base' && f.ownerId === base.id).sort(byPosition) : [];
    const typeFields = fields.filter((f) => f.owner === 'type' && f.ownerId === meta.id && meta.id !== 0).sort(byPosition);
    return [
      ...baseFields.map((f) => ({ ...f, required: true })),
      ...typeFields.map((f) => ({ ...f, required: false })),
    ];
  }, [base, fields, meta.id]);
}

/** Consultador "¿el tipo X tiene la capacidad Y?" para listas con eventos de varios tipos. */
export function useCapabilityLookup(): (typeKey: string, capability: Capability) => boolean {
  const types = useAppSelector((state) => state.eventTypes.items);
  const bases = useAppSelector((state) => state.eventBases.bases);
  return useMemo(() => capabilityLookup(types, bases), [types, bases]);
}
