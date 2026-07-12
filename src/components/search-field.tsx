import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';

/** Barra de búsqueda reutilizable (agenda y notas), con botón para limpiar. */
interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Etiqueta para lectores de pantalla y tests. */
  label: string;
}

export function SearchField({ value, onChange, placeholder, label }: SearchFieldProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Ionicons name="search" size={18} color={colors.textSubtle} />
      <TextInput
        style={styles.input}
        accessibilityLabel={label}
        placeholder={placeholder}
        placeholderTextColor={colors.textSubtle}
        value={value}
        onChangeText={onChange}
        autoCorrect={false}
        returnKeyType="search"
      />
      {value.length > 0 ? (
        <Pressable accessibilityLabel="Limpiar búsqueda" hitSlop={8} onPress={() => onChange('')}>
          <Ionicons name="close-circle" size={18} color={colors.textSubtle} />
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.surface,
      borderRadius: 12,
      paddingHorizontal: 12,
      marginHorizontal: 16,
      marginTop: 12,
    },
    input: { flex: 1, paddingVertical: 10, fontSize: 15, color: c.text },
  });
