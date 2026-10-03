import {
  DEFAULT_EVENT_BASES,
  MAX_TYPE_ITEMS,
  capabilityProblems,
  countTypeItems,
  itemLimitMessage,
  typeCapabilities,
} from '@/constants/event-bases';
import type { CustomField, EventBase } from '@/types';

const bases: EventBase[] = Object.entries(DEFAULT_EVENT_BASES).map(([key, base], index) => ({
  id: index + 1,
  key,
  ...base,
  isBuiltin: true,
}));

const field = (id: number, owner: CustomField['owner'], ownerId: number): CustomField => ({
  id,
  owner,
  ownerId,
  label: `Campo ${id}`,
  kind: 'texto',
  options: [],
  position: id,
});

describe('bases de fábrica', () => {
  it('cumplen sus propias reglas de compatibilidad', () => {
    for (const base of Object.values(DEFAULT_EVENT_BASES)) {
      expect(capabilityProblems(base.capabilities, base.yearly)).toEqual([]);
    }
  });

  it('solo cita médica obliga a poner hora', () => {
    const withTime = Object.entries(DEFAULT_EVENT_BASES).filter(([, b]) => b.requiresTime).map(([k]) => k);
    expect(withTime).toEqual(['cita_medica']);
  });
});

describe('capabilityProblems', () => {
  it('edad, años transcurridos y "¿ya lo saludé?" requieren repetición anual', () => {
    const problems = capabilityProblems(['edad', 'saludado'], false);
    expect(problems.map((p) => p.capability)).toEqual(['edad', 'saludado']);
    expect(capabilityProblems(['anios'], false).map((p) => p.capability)).toEqual(['anios']);
  });

  it('edad y años transcurridos son incompatibles entre sí', () => {
    const problems = capabilityProblems(['edad', 'anios'], true);
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toMatch(/a la vez/);
  });

  it('WhatsApp e ideas de regalo combinan con cualquier cosa', () => {
    expect(capabilityProblems(['whatsapp', 'regalos'], false)).toEqual([]);
    expect(capabilityProblems(['whatsapp', 'regalos'], true)).toEqual([]);
  });
});

describe('typeCapabilities', () => {
  it('suma las de la base y los extras sin repetir', () => {
    expect(typeCapabilities({ baseKey: 'cumpleanos', extraCapabilities: ['regalos'] }, bases)).toEqual([
      'edad', 'saludado', 'whatsapp', 'regalos',
    ]);
    expect(typeCapabilities({ baseKey: 'festivo', extraCapabilities: ['regalos'] }, bases)).toEqual(['regalos']);
  });

  it('sin tipo, no hay capacidades', () => {
    expect(typeCapabilities(undefined, bases)).toEqual([]);
  });
});

describe('límite de cosas por tipo', () => {
  it('cuenta capacidades, hora obligatoria, campos de la base y extras del tipo', () => {
    const citaBase = bases.find((b) => b.key === 'cita_medica') as EventBase;
    const fields = [field(1, 'base', citaBase.id), field(2, 'type', 9), field(3, 'type', 9), field(4, 'type', 99)];

    // regalos (1) + hora obligatoria (1) + 1 campo de la base + 2 extras del tipo 9.
    expect(countTypeItems({ id: 9, baseKey: 'cita_medica', extraCapabilities: ['regalos'] }, bases, fields)).toBe(5);
  });

  it(`deja llegar justo a ${MAX_TYPE_ITEMS} y avisa al pasarse`, () => {
    expect(itemLimitMessage(MAX_TYPE_ITEMS - 1)).toBeNull();
    expect(itemLimitMessage(MAX_TYPE_ITEMS)).toMatch(/hasta 15/);
    expect(itemLimitMessage(10, 6)).not.toBeNull();
  });
});
