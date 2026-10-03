import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { confirmDestructive, impactMessage } from '@/components/confirm';
import { EventTypeForm } from '@/components/event-type-form';
import { typeCapabilities } from '@/constants/event-bases';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  countRemovals,
  createTypeConfig,
  deleteTypeMovingEvents,
  deleteTypeWithEvents,
} from '@/store/type-config-thunks';
import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';
import type { EventTypeMeta, NewEventType, RemovalPlan } from '@/types';

interface DeleteTypePanelProps {
  type: EventTypeMeta;
  onDone: () => void;
  onCancel: () => void;
}

/**
 * Borrar un tipo que tiene eventos: primero se pregunta si se quieren mover.
 * Sí → a otro tipo de la misma base (o a uno nuevo, si no hay). No → se
 * borran los eventos. En los dos casos se confirma antes, con el conteo.
 */
export function DeleteTypePanel({ type, onDone, onCancel }: DeleteTypePanelProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const dispatch = useAppDispatch();

  const types = useAppSelector((state) => state.eventTypes.items);
  const bases = useAppSelector((state) => state.eventBases.bases);
  const fields = useAppSelector((state) => state.eventBases.fields);
  const allEvents = useAppSelector((state) => state.events.items);

  const events = allEvents.filter((e) => e.type === type.key);
  const candidates = types.filter((t) => t.baseKey === type.baseKey && t.key !== type.key);
  const baseLabel = bases.find((b) => b.key === type.baseKey)?.label ?? type.baseKey;

  const [mode, setMode] = useState<'preguntar' | 'mover' | 'crear'>('preguntar');
  const [destination, setDestination] = useState<string | null>(candidates[0]?.key ?? null);
  const [busy, setBusy] = useState(false);

  const count = `${events.length} ${events.length === 1 ? 'evento' : 'eventos'}`;

  /** Lo que el tipo destino no admite: capacidades que no tiene y los campos extra del tipo que se borra. */
  const planFor = (destinationType: Pick<EventTypeMeta, 'baseKey' | 'extraCapabilities'>): RemovalPlan => {
    const kept = typeCapabilities(destinationType, bases);
    return {
      capabilities: typeCapabilities(type, bases).filter((c) => !kept.includes(c)),
      fieldIds: fields.filter((f) => f.owner === 'type' && f.ownerId === type.id).map((f) => f.id),
      options: [],
    };
  };

  /** Avisa qué pasa (y qué datos se pierden) antes de mover. */
  const confirmMove = async (destinationLabel: string, plan: RemovalPlan) => {
    const impact = await countRemovals([type.key], plan, Object.fromEntries(fields.map((f) => [f.id, f.label])));
    const detail = impact.items.length > 0 ? `\n\n${impactMessage(impact)}` : '';
    return confirmDestructive(
      'Mover y borrar el tipo',
      `Los ${count} de "${type.label}" pasan a "${destinationLabel}" y el tipo se borra.${detail}`,
      'Mover y borrar',
    );
  };

  const executeMove = async (destinationKey: string, plan: RemovalPlan) => {
    setBusy(true);
    try {
      await dispatch(deleteTypeMovingEvents({ id: type.id, sourceKey: type.key, destinationKey, plan })).unwrap();
      onDone();
    } finally {
      setBusy(false);
    }
  };

  const handleMove = async () => {
    const target = candidates.find((t) => t.key === destination);
    if (!target) return;
    const plan = planFor(target);
    if (await confirmMove(target.label, plan)) await executeMove(target.key, plan);
  };

  /** Se confirma antes de crear: si se cancela, no queda un tipo nuevo de más. */
  const handleCreateAndMove = async (data: NewEventType) => {
    const plan = planFor(data);
    if (!(await confirmMove(data.label, plan))) return;
    const created = await dispatch(createTypeConfig(data)).unwrap();
    await executeMove(created.key, plan);
  };

  const handleDeleteEvents = async () => {
    const ok = await confirmDestructive(
      'Borrar tipo y eventos',
      `Se borran los ${count} de "${type.label}" con sus recordatorios, ideas de regalo y demás datos. No se puede deshacer.`,
      'Borrar todo',
    );
    if (!ok) return;
    setBusy(true);
    try {
      await dispatch(deleteTypeWithEvents({ id: type.id, key: type.key, events })).unwrap();
      onDone();
    } finally {
      setBusy(false);
    }
  };

  if (mode === 'crear') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Nuevo tipo para los {count}</Text>
        <EventTypeForm
          lockedBaseKey={type.baseKey}
          onSubmit={(data) => void handleCreateAndMove(data)}
          onCancel={() => setMode('mover')}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Borrar "{type.label}"</Text>
      <Text style={styles.text}>Tiene {count}. ¿Querés moverlos a otro tipo?</Text>

      {mode === 'preguntar' ? (
        <View style={styles.actions}>
          <Pressable style={styles.secondary} onPress={() => setMode('mover')}>
            <Text style={styles.secondaryText}>Sí, moverlos</Text>
          </Pressable>
          <Pressable style={styles.danger} disabled={busy} onPress={() => void handleDeleteEvents()}>
            <Text style={styles.dangerText}>No, borrarlos</Text>
          </Pressable>
        </View>
      ) : candidates.length > 0 ? (
        <>
          <Text style={styles.label}>Tipos con la base {baseLabel}</Text>
          <View style={styles.chipRow}>
            {candidates.map((t) => {
              const active = t.key === destination;
              return (
                <Pressable
                  key={t.key}
                  accessibilityLabel={`Mover a ${t.label}`}
                  accessibilityState={{ selected: active }}
                  style={[styles.chip, active && { backgroundColor: t.color, borderColor: t.color }]}
                  onPress={() => setDestination(t.key)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable style={styles.danger} disabled={busy || !destination} onPress={() => void handleMove()}>
            <Text style={styles.dangerText}>Mover y borrar el tipo</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.text}>No hay otro tipo con la base {baseLabel}.</Text>
          <Pressable style={styles.secondary} onPress={() => setMode('crear')}>
            <Text style={styles.secondaryText}>Crear nuevo tipo y moverlos</Text>
          </Pressable>
        </>
      )}

      <Pressable style={styles.cancel} onPress={onCancel}>
        <Text style={styles.cancelText}>Cancelar</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { gap: 10, backgroundColor: c.surfaceAlt, borderRadius: 14, padding: 14 },
    title: { fontSize: 15, fontWeight: '700', color: c.text },
    text: { fontSize: 13.5, color: c.textMuted },
    label: { fontSize: 12.5, fontWeight: '600', color: c.textMuted },
    actions: { flexDirection: 'row', gap: 8 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { borderWidth: 1, borderColor: c.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: c.surface },
    chipText: { fontSize: 13, color: c.textMuted },
    chipTextActive: { color: '#fff', fontWeight: '600' },
    secondary: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 20, borderWidth: 1, borderColor: c.primary },
    secondaryText: { color: c.primary, fontWeight: '600' },
    danger: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 20, backgroundColor: c.danger },
    dangerText: { color: '#fff', fontWeight: '700' },
    cancel: { alignItems: 'center', paddingVertical: 8 },
    cancelText: { color: c.textMuted, fontWeight: '600' },
  });
