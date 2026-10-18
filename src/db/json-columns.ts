import { CAPABILITIES, type Capability } from '@/types';

/**
 * Lectura defensiva de columnas que guardan listas JSON (capacidades,
 * opciones de un campo). Un valor corrupto no debe romper la carga de la app:
 * se ignora lo que no se entiende.
 */

function parseStringList(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function parseCapabilities(raw: string): Capability[] {
  return parseStringList(raw).filter((item): item is Capability =>
    (CAPABILITIES as readonly string[]).includes(item),
  );
}

export function parseOptions(raw: string): string[] {
  return parseStringList(raw);
}
