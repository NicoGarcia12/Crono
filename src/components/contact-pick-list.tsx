import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { ContactCandidate } from '@/contacts/birthday-import';
import { formatLongDate } from '@/utils/dates';

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
        placeholderTextColor="#999"
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
                <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
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
                  <Ionicons name="trash-outline" size={20} color="#E91E63" />
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
                color={checked ? '#208AEF' : '#999'}
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  search: {
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 16,
    marginBottom: 4,
    padding: 12,
    fontSize: 15,
    color: '#1a1a2e',
  },
  listContent: { padding: 16, gap: 8, paddingBottom: 96 },
  empty: { textAlign: 'center', color: '#999', padding: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
  },
  rowLoaded: { backgroundColor: '#f0f8f1' },
  rowBody: { flex: 1, gap: 2 },
  rowName: { fontSize: 16, fontWeight: '600', color: '#1a1a2e' },
  rowHint: { fontSize: 12.5, color: '#999' },
  rowLoadedText: { fontSize: 12.5, color: '#4CAF50' },
  continueButton: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
    backgroundColor: '#208AEF',
    borderRadius: 24,
    padding: 15,
    alignItems: 'center',
  },
  continueDisabled: { opacity: 0.4 },
  continueText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
