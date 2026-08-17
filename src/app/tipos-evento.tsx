import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EventTypeForm } from '@/components/event-type-form';
import { useAppDispatch, useAppSelector } from '@/store';
import { addEventType, editEventType, removeEventType } from '@/store/event-types-slice';
import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';
import type { EventTypeMeta, NewEventType } from '@/types';

/**
 * Tipos de evento: los 5 de fábrica (label/ícono/color editables, pero no se
 * pueden borrar ni cambiarles la clave) más los que el usuario cree acá.
 */
export default function TiposEventoScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const dispatch = useAppDispatch();
  const types = useAppSelector((state) => state.eventTypes.items);
  const events = useAppSelector((state) => state.events.items);

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const usageCount = (key: string) => events.filter((event) => event.type === key).length;

  const handleCreate = (data: NewEventType) => {
    void dispatch(addEventType(data));
    setCreating(false);
  };

  const handleEdit = (id: number, data: NewEventType) => {
    void dispatch(editEventType({ id, data }));
    setEditingId(null);
  };

  const handleDelete = (type: EventTypeMeta) => {
    const count = usageCount(type.key);
    if (count > 0) {
      Alert.alert(
        'No se puede borrar',
        `Hay ${count} ${count === 1 ? 'evento' : 'eventos'} usando "${type.label}". Cambiales el tipo antes de borrarlo.`,
      );
      return;
    }
    Alert.alert('Borrar tipo', `¿Borrar "${type.label}"? No se puede deshacer.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => void dispatch(removeEventType(type.id)) },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {types.map((type) =>
        editingId === type.id ? (
          <EventTypeForm
            key={type.id}
            initial={type}
            onSubmit={(data) => handleEdit(type.id, data)}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <View key={type.id} style={styles.row}>
            <View style={[styles.iconCircle, { backgroundColor: `${type.color}22` }]}>
              <Ionicons name={type.icon as keyof typeof Ionicons.glyphMap} size={20} color={type.color} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>{type.label}</Text>
              {type.isBuiltin ? <Text style={styles.rowHint}>De fábrica</Text> : null}
            </View>
            <Pressable
              accessibilityLabel={`Editar tipo ${type.label}`}
              hitSlop={8}
              onPress={() => setEditingId(type.id)}
            >
              <Ionicons name="pencil" size={18} color={colors.textSubtle} />
            </Pressable>
            {!type.isBuiltin ? (
              <Pressable
                accessibilityLabel={`Borrar tipo ${type.label}`}
                hitSlop={8}
                onPress={() => handleDelete(type)}
              >
                <Ionicons name="trash" size={18} color={colors.danger} />
              </Pressable>
            ) : null}
          </View>
        ),
      )}

      {creating ? (
        <EventTypeForm onSubmit={handleCreate} onCancel={() => setCreating(false)} />
      ) : (
        <Pressable style={styles.addButton} accessibilityLabel="Crear tipo de evento" onPress={() => setCreating(true)}>
          <Ionicons name="add" size={18} color={colors.primary} />
          <Text style={styles.addText}>Nuevo tipo</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 16, gap: 10, paddingBottom: 48 },
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
