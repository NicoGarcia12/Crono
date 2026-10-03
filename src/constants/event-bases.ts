import type { Capability, CustomField, EventBase, EventTypeMeta } from '@/types';

/**
 * Catálogo de bases y capacidades de los tipos de evento.
 *
 * 💡 Aprendizaje: un tipo = su base (bloqueada) + extras opcionales. Todo lo
 * que decide "qué puede hacer un evento" se consulta acá por capacidad, en
 * vez de comparar claves literales como `type === 'cumpleanos'`.
 */

/** Claves de las 5 bases de fábrica. Coinciden con las claves de los 5 tipos de fábrica. */
export const BUILTIN_BASE_KEYS = ['evento', 'cumpleanos', 'aniversario', 'festivo', 'cita_medica'] as const;

export type BuiltinBaseKey = (typeof BUILTIN_BASE_KEYS)[number];

/** El tipo "Evento" es el que viene elegido al crear y no se puede borrar. */
export const DEFAULT_TYPE_KEY = 'evento';

export const DEFAULT_EVENT_BASES: Record<
  BuiltinBaseKey,
  Pick<EventBase, 'label' | 'yearly' | 'requiresTime' | 'capabilities'>
> = {
  evento: { label: 'Evento', yearly: false, requiresTime: false, capabilities: [] },
  cumpleanos: {
    label: 'Cumpleaños',
    yearly: true,
    requiresTime: false,
    capabilities: ['edad', 'saludado', 'whatsapp', 'regalos'],
  },
  aniversario: { label: 'Aniversario', yearly: true, requiresTime: false, capabilities: ['anios'] },
  festivo: { label: 'Festivo', yearly: true, requiresTime: false, capabilities: [] },
  cita_medica: { label: 'Cita médica', yearly: false, requiresTime: true, capabilities: [] },
};

/** Textos de cada capacidad, para el editor de tipos. */
export const CAPABILITY_META: Record<Capability, { label: string; description: string }> = {
  edad: { label: 'Edad', description: 'Muestra cuántos cumple este año.' },
  anios: { label: 'Años transcurridos', description: 'Muestra cuántos años pasaron desde la fecha.' },
  saludado: { label: '¿Ya lo saludé?', description: 'Un check por año para marcar si saludaste.' },
  whatsapp: { label: 'Saludo por WhatsApp', description: 'Teléfono opcional y botón para abrir el chat.' },
  regalos: { label: 'Ideas de regalo', description: 'Una lista de ideas para regalarle.' },
};

/** Máximo de cosas (capacidades + hora obligatoria + campos) que puede tener un tipo. */
export const MAX_TYPE_ITEMS = 15;

export interface CapabilityProblem {
  capability: Capability;
  message: string;
}

/**
 * Reglas de compatibilidad. Devuelve un problema por capacidad inválida
 * (vacío = combinación válida), con el motivo listo para mostrar.
 */
export function capabilityProblems(capabilities: readonly Capability[], yearly: boolean): CapabilityProblem[] {
  const problems: CapabilityProblem[] = [];
  const has = (c: Capability) => capabilities.includes(c);

  if (!yearly) {
    if (has('edad')) problems.push({ capability: 'edad', message: 'La edad solo tiene sentido si se repite todos los años.' });
    if (has('anios')) {
      problems.push({ capability: 'anios', message: 'Los años transcurridos solo tienen sentido si se repite todos los años.' });
    }
    if (has('saludado')) {
      problems.push({ capability: 'saludado', message: '"¿Ya lo saludé?" se reinicia cada año: necesita repetirse todos los años.' });
    }
  }
  if (has('edad') && has('anios')) {
    problems.push({ capability: 'anios', message: 'No se puede tener edad y años transcurridos a la vez: los dos muestran años.' });
  }
  return problems;
}

/** Capacidades efectivas de un tipo: las de su base más sus extras, sin repetir. */
export function typeCapabilities(
  type: Pick<EventTypeMeta, 'baseKey' | 'extraCapabilities'> | undefined,
  bases: readonly Pick<EventBase, 'key' | 'capabilities'>[],
): Capability[] {
  if (!type) return [];
  const base = bases.find((b) => b.key === type.baseKey);
  return [...new Set([...(base?.capabilities ?? []), ...type.extraCapabilities])];
}

/**
 * Arma un consultador "¿el tipo X tiene la capacidad Y?" a partir de los
 * tipos y bases cargados. Lo usan las funciones puras (calendario, saludos,
 * WhatsApp) para no depender de claves literales.
 */
export function capabilityLookup(
  types: readonly Pick<EventTypeMeta, 'key' | 'baseKey' | 'extraCapabilities'>[],
  bases: readonly Pick<EventBase, 'key' | 'capabilities'>[],
): (typeKey: string, capability: Capability) => boolean {
  const byType = new Map(types.map((t) => [t.key, new Set(typeCapabilities(t, bases))]));
  return (typeKey, capability) => byType.get(typeKey)?.has(capability) ?? false;
}

/** Cuántas cosas suma un tipo contra el límite de MAX_TYPE_ITEMS. */
export function countTypeItems(
  type: Pick<EventTypeMeta, 'id' | 'baseKey' | 'extraCapabilities'>,
  bases: readonly EventBase[],
  fields: readonly CustomField[],
): number {
  const base = bases.find((b) => b.key === type.baseKey);
  const baseFields = base ? fields.filter((f) => f.owner === 'base' && f.ownerId === base.id).length : 0;
  const typeFields = fields.filter((f) => f.owner === 'type' && f.ownerId === type.id).length;
  return (
    typeCapabilities(type, bases).length + (base?.requiresTime ? 1 : 0) + baseFields + typeFields
  );
}

/** Mensaje si agregar `adding` cosas más supera el límite; null si entra. */
export function itemLimitMessage(currentCount: number, adding = 1): string | null {
  if (currentCount + adding <= MAX_TYPE_ITEMS) return null;
  return `Un tipo puede tener hasta ${MAX_TYPE_ITEMS} cosas entre lo de su base y los extras. Sacá alguna antes de agregar otra.`;
}
