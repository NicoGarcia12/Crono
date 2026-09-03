import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { ContactCandidate } from '@/contacts/birthday-import';
import { formatLongDate } from '@/utils/dates';
import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Lista de TODOS los contactos del celular con selección múltiple.
 * Los que ya tienen el cumpleaños cargado en Crono muestran la fecha y un
 * botón para borrarlo. Componente presentacional: no toca contactos ni Redux.
 */

interface ContactPickListProps {
  candidates: ContactCandidate[];
  onContinue: (selected: ContactCandidate[]) => void;
  onDelete: (candidate: ContactCandidate) => void;
}

export function ContactPickList({ candidates, onContinue, onDelete }: ContactPickListProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const toggle = (key: string) => {
    setSelectedKeys((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const visible = candidates.filter((c) =>
    c.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const selected = candidates.filter((c) => selectedKeys.has(c.key) && !c.loaded);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        accessibilityLabel="Buscar contacto"
        placeholder="Buscar contacto…"
        placeholderTextColor={colors.textSubtle}
        value={search}
        onChangeText={setSearch}
      />

      <FlatList
        data={visible}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.empty}>No hay contactos con ese nombre.</Text>}
        renderItem={({ item }) => {
          const checked = selectedKeys.has(item.key);

          // Ya cargado: no se puede volver a elegir, pero sí borrar.
          if (item.loaded) {
            return (
              <View style={[styles.row, styles.rowLoaded]}>
                <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.rowLoadedText} numberOfLines={1}>
                    Ya cargado · {formatLongDate(item.loaded.date)}
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel={`Borrar cumpleaños de ${item.name}`}
                  hitSlop={10}
                  onPress={() => onDelete(item)}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </Pressable>
              </View>
            );
          }

          return (
            <Pressable
              style={styles.row}
              accessibilityLabel={`Contacto ${item.name}`}
              onPress={() => toggle(item.key)}
            >
              <Ionicons
                name={checked ? 'checkbox' : 'square-outline'}
                size={24}
                color={checked ? '#168BFF' : '#999'}
              />
              <View style={styles.rowBody}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.rowHint} numberOfLines={1}>
                  {item.suggestedDate
                    ? `Cumpleaños en tus contactos: ${formatLongDate(item.suggestedDate)}`
                    : item.phone ?? 'Sin teléfono'}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />

      <Pressable
        style={[styles.continueButton, selected.length === 0 && styles.continueDisabled]}
        disabled={selected.length === 0}
        onPress={() => onContinue(selected)}
      >
        <Text style={styles.continueText}>
          {selected.length === 1
            ? 'Cargar 1 cumpleaños'
            : `Cargar ${selected.length} cumpleaños`}
        </Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1 },
  search: {
    backgroundColor: c.surface,
    borderRadius: 12,
    margin: 16,
    marginBottom: 4,
    padding: 12,
    fontSize: 15,
    color: c.text,
  },
  listContent: { padding: 16, gap: 8, paddingBottom: 96 },
  empty: { textAlign: 'center', color: c.textSubtle, padding: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 14,
  },
  rowLoaded: { backgroundColor: c.surfaceAlt },
  rowBody: { flex: 1, gap: 2 },
  rowName: { fontSize: 16, fontWeight: '600', color: c.text },
  rowHint: { fontSize: 12.5, color: c.textSubtle },
  rowLoadedText: { fontSize: 12.5, color: c.success },
  continueButton: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
    backgroundColor: c.primary,
    borderRadius: 24,
    padding: 15,
    alignItems: 'center',
  },
  continueDisabled: { opacity: 0.4 },
  continueText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
