import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

/** Barra de búsqueda reutilizable (agenda y notas), con botón para limpiar. */
interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Etiqueta para lectores de pantalla y tests. */
  label: string;
}

export function SearchField({ value, onChange, placeholder, label }: SearchFieldProps) {
  return (
    <View style={styles.container}>
      <Ionicons name="search" size={18} color="#999" />
      <TextInput
        style={styles.input}
        accessibilityLabel={label}
        placeholder={placeholder}
        placeholderTextColor="#999"
        value={value}
        onChangeText={onChange}
        autoCorrect={false}
        returnKeyType="search"
      />
      {value.length > 0 ? (
        <Pressable accessibilityLabel="Limpiar búsqueda" hitSlop={8} onPress={() => onChange('')}>
          <Ionicons name="close-circle" size={18} color="#bbb" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginTop: 12,
  },
  input: { flex: 1, paddingVertical: 10, fontSize: 15, color: '#1a1a2e' },
});
