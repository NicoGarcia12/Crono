import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { GiftIdea } from '@/types';
import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Ideas de regalo de una persona: viñetas de texto libre, no un checklist.
 * Al regalar algo se marca y la idea se saca de la lista (sin historial).
 */

interface GiftIdeasListProps {
  items: GiftIdea[];
  onAdd: (text: string) => void;
  onEdit: (id: number, text: string) => void;
  onGiven: (item: GiftIdea) => void;
}

export function GiftIdeasList({ items, onAdd, onEdit, onGiven }: GiftIdeasListProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');

  const canAdd = draft.trim().length > 0;

  const add = () => {
    if (!canAdd) return;
    onAdd(draft.trim());
    setDraft('');
  };

  const startEdit = (item: GiftIdea) => {
    setEditingId(item.id);
    setEditingText(item.text);
  };

  const commitEdit = () => {
    if (editingId === null) return;
    const trimmed = editingText.trim();
    if (trimmed.length > 0 && trimmed !== items.find((i) => i.id === editingId)?.text) {
      onEdit(editingId, trimmed);
    }
    setEditingId(null);
  };

  const confirmGiven = (item: GiftIdea) => {
    Alert.alert('¿Ya se lo diste?', `"${item.text}" se va a sacar de la lista.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Ya se lo di', onPress: () => onGiven(item) },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>💡 Ideas de regalo</Text>

      {items.length === 0 ? (
        <Text style={styles.empty}>Todavía no anotaste ideas. Agregá las que se te ocurran.</Text>
      ) : (
        <View style={styles.list}>
          {items.map((item) =>
            editingId === item.id ? (
              <TextInput
                key={item.id}
                style={styles.editInput}
                accessibilityLabel={`Editar idea "${item.text}"`}
                value={editingText}
                onChangeText={setEditingText}
                autoFocus
                multiline
                onBlur={commitEdit}
                onSubmitEditing={commitEdit}
                returnKeyType="done"
              />
            ) : (
              <View key={item.id} style={styles.row}>
                <Pressable
                  style={styles.rowMain}
                  accessibilityLabel={`Editar idea "${item.text}"`}
                  onPress={() => startEdit(item)}
                >
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.rowText}>{item.text}</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={`Marcar "${item.text}" como regalado`}
                  hitSlop={8}
                  onPress={() => confirmGiven(item)}
                >
                  <Ionicons name="gift-outline" size={20} color={colors.primary} />
                </Pressable>
              </View>
            ),
          )}
        </View>
      )}

      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          accessibilityLabel="Nueva idea de regalo"
          placeholder="Ej: campera, entradas al cine..."
          placeholderTextColor={colors.textSubtle}
          value={draft}
          onChangeText={setDraft}
          returnKeyType="done"
          onSubmitEditing={add}
        />
        <Pressable
          style={[styles.addButton, !canAdd && styles.addButtonDisabled]}
          disabled={!canAdd}
          accessibilityLabel="Agregar idea"
          onPress={add}
        >
          <Ionicons name="add" size={20} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      backgroundColor: c.surface,
      borderRadius: 14,
      marginHorizontal: 16,
      marginTop: 12,
      padding: 14,
      gap: 10,
    },
    title: { fontSize: 15.5, fontWeight: '700', color: c.text },
    empty: { fontSize: 13, color: c.textSubtle, fontStyle: 'italic' },
    list: { gap: 4 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    rowMain: { flex: 1, flexDirection: 'row', gap: 8, paddingVertical: 6 },
    bullet: { fontSize: 15, color: c.textSubtle },
    rowText: { flex: 1, fontSize: 15, color: c.text },
    editInput: {
      backgroundColor: c.surfaceAlt,
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 15,
      color: c.text,
    },
    addRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
    addInput: {
      flex: 1,
      backgroundColor: c.surfaceAlt,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 14,
      color: c.text,
    },
    addButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addButtonDisabled: { opacity: 0.35 },
  });
