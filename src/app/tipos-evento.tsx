import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStore } from 'react-redux';

import { confirmAction, confirmDestructive, impactMessage, notify } from '@/components/confirm';
import { DeleteTypePanel } from '@/components/delete-type-panel';
import { EventBaseForm } from '@/components/event-base-form';
import { FillFieldsPanel } from '@/components/fill-fields-panel';
import { EventTypeForm } from '@/components/event-type-form';
import { DEFAULT_TYPE_KEY, isEmptyPlan, planRemovals } from '@/constants/event-bases';
import { useAppDispatch, useAppSelector, type RootState } from '@/store';
import {
  countRemovals,
  createBaseConfig,
  createTypeConfig,
  deleteBaseConfig,
  deleteTypeConfig,
  saveBaseConfig,
  saveTypeConfig,
} from '@/store/type-config-thunks';
import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';
import type { EventBase, EventTypeMeta, NewEventBase, NewEventType, RemovalPlan } from '@/types';

/**
 * Tipos de evento y bases. Un tipo sale de una base (bloqueada) y le suma
 * extras; las bases de fábrica no se editan, las propias sí. Si al guardar se
 * quita algo con datos, primero se avisa cuántos se pierden.
 */
export default function TiposEventoScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const dispatch = useAppDispatch();
  const allTypes = useAppSelector((state) => state.eventTypes.items);
  // Los ocultos (ej. "Mi cumpleaños") no se editan ni se borran desde acá.
  const types = useMemo(() => allTypes.filter((t) => !t.hidden), [allTypes]);
  const bases = useAppSelector((state) => state.eventBases.bases);
  const fields = useAppSelector((state) => state.eventBases.fields);
  const events = useAppSelector((state) => state.events.items);

  const [editing, setEditing] = useState<{ kind: 'type' | 'base' | 'delete'; id: number | 'nuevo' } | null>(null);
  const [filling, setFilling] = useState<{ eventIds: number[]; fieldIds: number[] } | null>(null);
  const store = useStore<RootState>();

  /**
   * Si al guardar se agregaron datos nuevos y hay eventos de esos tipos,
   * pregunta si se quieren cargar ahora, de a uno.
   */
  const offerToFill = async (owner: 'type' | 'base', ownerId: number, typeKeys: string[], previousFieldIds: Set<number>) => {
    const state = store.getState();
    const added = state.eventBases.fields.filter((f) => f.owner === owner && f.ownerId === ownerId && !previousFieldIds.has(f.id));
    const eventIds = state.events.items.filter((e) => typeKeys.includes(e.type)).map((e) => e.id);
    if (added.length === 0 || eventIds.length === 0) return;
    const names = added.map((f) => `«${f.label}»`).join(', ');
    const ok = await confirmAction(
      'Dato nuevo',
      `Agregaste ${names}. Hay ${eventIds.length} ${eventIds.length === 1 ? 'evento' : 'eventos'} que todavía no lo tienen. ¿Querés cargarlo ahora, uno por uno?`,
      'Cargar',
    );
    if (ok) setFilling({ eventIds, fieldIds: added.map((f) => f.id) });
  };

  const usageCount = (key: string) => events.filter((event) => event.type === key).length;
  const fieldLabels = useMemo(() => Object.fromEntries(fields.map((f) => [f.id, f.label])), [fields]);

  /** Si el plan borra datos, avisa con el conteo y espera la confirmación. */
  const confirmPlan = async (typeKeys: string[], plan: RemovalPlan): Promise<boolean> => {
    if (isEmptyPlan(plan)) return true;
    const impact = await countRemovals(typeKeys, plan, fieldLabels);
    if (impact.items.length === 0) return true;
    return confirmDestructive('Se van a borrar datos', impactMessage(impact), 'Borrar y guardar');
  };

  const handleSaveType = async (type: EventTypeMeta | null, data: NewEventType) => {
    if (!type) {
      await dispatch(createTypeConfig(data)).unwrap();
      setEditing(null);
      return;
    }
    const plan = type.isBuiltin
      ? { capabilities: [], fieldIds: [], options: [] }
      : planRemovals(
          { capabilities: type.extraCapabilities, fields: fields.filter((f) => f.owner === 'type' && f.ownerId === type.id) },
          { capabilities: data.extraCapabilities, fields: data.fields },
        );
    if (!(await confirmPlan([type.key], plan))) return;
    const previous = new Set(fields.filter((f) => f.owner === 'type' && f.ownerId === type.id).map((f) => f.id));
    await dispatch(saveTypeConfig({ id: type.id, data, plan })).unwrap();
    setEditing(null);
    await offerToFill('type', type.id, [type.key], previous);
  };

  const handleSaveBase = async (base: EventBase | null, data: NewEventBase) => {
    if (!base) {
      await dispatch(createBaseConfig(data)).unwrap();
      setEditing(null);
      return;
    }
    const plan = planRemovals(
      { capabilities: base.capabilities, fields: fields.filter((f) => f.owner === 'base' && f.ownerId === base.id) },
      { capabilities: data.capabilities, fields: data.fields },
    );
    const typeKeys = types.filter((t) => t.baseKey === base.key).map((t) => t.key);
    if (!(await confirmPlan(typeKeys, plan))) return;
    const previous = new Set(fields.filter((f) => f.owner === 'base' && f.ownerId === base.id).map((f) => f.id));
    await dispatch(saveBaseConfig({ id: base.id, data, plan })).unwrap();
    setEditing(null);
    await offerToFill('base', base.id, typeKeys, previous);
  };

  /** Sin eventos se borra con una confirmación simple; con eventos se abre el panel que pregunta si moverlos. */
  const handleDelete = async (type: EventTypeMeta) => {
    if (usageCount(type.key) > 0) {
      setEditing({ kind: 'delete', id: type.id });
      return;
    }
    if (await confirmDestructive('Borrar tipo', `¿Borrar "${type.label}"? No se puede deshacer.`, 'Borrar')) {
      await dispatch(deleteTypeConfig(type.id)).unwrap();
    }
  };

  const handleDeleteBase = async (base: EventBase) => {
    const used = types.filter((t) => t.baseKey === base.key).length;
    if (used > 0) {
      notify(
        'No se puede borrar',
        `Hay ${used} ${used === 1 ? 'tipo' : 'tipos'} con la base "${base.label}". Borralos (o mové sus eventos) primero.`,
      );
      return;
    }
    if (await confirmDestructive('Borrar base', `¿Borrar la base "${base.label}"? No se puede deshacer.`, 'Borrar')) {
      await dispatch(deleteBaseConfig(base.id)).unwrap();
    }
  };

  const isEditing = (kind: 'type' | 'base' | 'delete', id: number | 'nuevo') =>
    editing?.kind === kind && editing.id === id;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {filling ? (
        <FillFieldsPanel eventIds={filling.eventIds} fieldIds={filling.fieldIds} onDone={() => setFilling(null)} />
      ) : null}

      <Text style={styles.section}>Tipos</Text>
      {types.map((type) =>
        isEditing('delete', type.id) ? (
          <DeleteTypePanel key={type.id} type={type} onDone={() => setEditing(null)} onCancel={() => setEditing(null)} />
        ) : isEditing('type', type.id) ? (
          <EventTypeForm
            key={type.id}
            initial={type}
            onSubmit={(data) => void handleSaveType(type, data)}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <View key={type.id} style={styles.row}>
            <View style={[styles.iconCircle, { backgroundColor: `${type.color}22` }]}>
              <Ionicons name={type.icon as keyof typeof Ionicons.glyphMap} size={20} color={type.color} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>{type.label}</Text>
              <Text style={styles.rowHint}>
                {type.isBuiltin ? 'De fábrica' : `Base: ${bases.find((b) => b.key === type.baseKey)?.label ?? '—'}`}
              </Text>
            </View>
            <Pressable
              accessibilityLabel={`Editar tipo ${type.label}`}
              hitSlop={8}
              onPress={() => setEditing({ kind: 'type', id: type.id })}
            >
              <Ionicons name="pencil" size={18} color={colors.textSubtle} />
            </Pressable>
            {/* "Evento" es el tipo por defecto al crear: no se puede borrar. */}
            {type.key !== DEFAULT_TYPE_KEY ? (
              <Pressable accessibilityLabel={`Borrar tipo ${type.label}`} hitSlop={8} onPress={() => void handleDelete(type)}>
                <Ionicons name="trash" size={18} color={colors.danger} />
              </Pressable>
            ) : null}
          </View>
        ),
      )}
      {isEditing('type', 'nuevo') ? (
        <EventTypeForm onSubmit={(data) => void handleSaveType(null, data)} onCancel={() => setEditing(null)} />
      ) : (
        <Pressable
          style={styles.addButton}
          accessibilityLabel="Crear tipo de evento"
          onPress={() => setEditing({ kind: 'type', id: 'nuevo' })}
        >
          <Ionicons name="add" size={18} color={colors.primary} />
          <Text style={styles.addText}>Nuevo tipo</Text>
        </Pressable>
      )}

      <Text style={styles.section}>Bases</Text>
      <Text style={styles.sectionHint}>
        Cada tipo sale de una base: lo que trae la base viene bloqueado y el tipo le suma extras.
      </Text>
      {bases.map((base) =>
        isEditing('base', base.id) ? (
          <EventBaseForm
            key={base.id}
            initial={base}
            onSubmit={(data) => void handleSaveBase(base, data)}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <View key={base.id} style={styles.row}>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>{base.label}</Text>
              <Text style={styles.rowHint}>
                {base.isBuiltin ? 'De fábrica · ' : ''}
                {base.yearly ? 'se repite todos los años' : 'por única vez'}
              </Text>
            </View>
            {!base.isBuiltin ? (
              <>
                <Pressable
                  accessibilityLabel={`Editar base ${base.label}`}
                  hitSlop={8}
                  onPress={() => setEditing({ kind: 'base', id: base.id })}
                >
                  <Ionicons name="pencil" size={18} color={colors.textSubtle} />
                </Pressable>
                <Pressable accessibilityLabel={`Borrar base ${base.label}`} hitSlop={8} onPress={() => void handleDeleteBase(base)}>
                  <Ionicons name="trash" size={18} color={colors.danger} />
                </Pressable>
              </>
            ) : (
              <Ionicons name="lock-closed" size={16} color={colors.textSubtle} />
            )}
          </View>
        ),
      )}
      {isEditing('base', 'nuevo') ? (
        <EventBaseForm onSubmit={(data) => void handleSaveBase(null, data)} onCancel={() => setEditing(null)} />
      ) : (
        <Pressable
          style={styles.addButton}
          accessibilityLabel="Crear base"
          onPress={() => setEditing({ kind: 'base', id: 'nuevo' })}
        >
          <Ionicons name="add" size={18} color={colors.primary} />
          <Text style={styles.addText}>Nueva base</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 16, gap: 10, paddingBottom: 48 },
    section: { fontSize: 13, fontWeight: '700', color: c.textMuted, textTransform: 'uppercase', marginTop: 8 },
    sectionHint: { fontSize: 12.5, color: c.textSubtle },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 12,
    },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowBody: { flex: 1, gap: 1 },
    rowLabel: { fontSize: 15, fontWeight: '600', color: c.text },
    rowHint: { fontSize: 11.5, color: c.textSubtle },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: 20,
      paddingVertical: 12,
    },
    addText: { color: c.primary, fontWeight: '600' },
  });
