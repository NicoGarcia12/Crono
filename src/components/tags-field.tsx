import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Editor de etiquetas libres de un evento (familia, amigos, trabajo...).
 * Texto libre: escribís el nombre y lo agregás; no hay una lista cerrada.
 */

interface TagsFieldProps {
  value: string[];
  onChange: (tags: string[]) => void;
}

export function TagsField({ value, onChange }: TagsFieldProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [text, setText] = useState('');

  const add = () => {
    const name = text.trim();
    if (name.length === 0) return;
    if (value.some((tag) => tag.toLowerCase() === name.toLowerCase())) {
      setText('');
      return; // ya está: no duplicamos
    }
    onChange([...value, name]);
    setText('');
  };

  const remove = (name: string) => {
    onChange(value.filter((tag) => tag !== name));
  };

  return (
    <View style={styles.container}>
      {value.length > 0 ? (
        <View style={styles.chipRow}>
          {value.map((tag) => (
            <View key={tag} style={styles.chip}>
              <Text style={styles.chipText}>{tag}</Text>
              <Pressable accessibilityLabel={`Quitar etiqueta ${tag}`} hitSlop={8} onPress={() => remove(tag)}>
                <Ionicons name="close" size={14} color={colors.primary} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.row}>
        <TextInput
          style={styles.input}
          accessibilityLabel="Nueva etiqueta"
          placeholder="Ej: familia, amigos, trabajo…"
          placeholderTextColor={colors.textSubtle}
          value={text}
          onChangeText={setText}
          returnKeyType="done"
          onSubmitEditing={add}
        />
        <Pressable accessibilityLabel="Agregar etiqueta" style={styles.addButton} onPress={add}>
          <Ionicons name="add" size={18} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { gap: 8 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: `${c.primary}66`,
      borderRadius: 20,
      paddingLeft: 12,
      paddingRight: 10,
      paddingVertical: 6,
      backgroundColor: c.surface,
    },
    chipText: { fontSize: 12.5, color: c.primary },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    input: {
      flex: 1,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      padding: 12,
      fontSize: 15,
      color: c.text,
    },
    addButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
