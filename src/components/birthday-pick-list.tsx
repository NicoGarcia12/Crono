import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import type { BirthdayCandidate } from '@/contacts/birthday-import';
import { formatLongDate } from '@/utils/dates';

/**
 * Lista de cumpleaños candidatos con selección múltiple.
 * Componente presentacional: recibe los candidatos por props y avisa qué
 * importar — no toca contactos ni Redux (así se testea con Jest sin celular).
 */

interface BirthdayPickListProps {
  candidates: BirthdayCandidate[];
  importing?: boolean;
  onImport: (selected: BirthdayCandidate[]) => void;
}

export function BirthdayPickList({ candidates, importing, onImport }: BirthdayPickListProps) {
  // Arrancan seleccionados todos los que todavía no están en la agenda.
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    () => new Set(candidates.filter((c) => !c.alreadyImported).map((c) => c.key)),
  );

  const toggle = (key: string) => {
    setSelectedKeys((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selected = candidates.filter((c) => selectedKeys.has(c.key) && !c.alreadyImported);
  const canImport = selected.length > 0 && !importing;

  return (
    <View style={styles.container}>
      {/* RNTL no reconoce el host RCTScrollView de FlatList como lista; este
          contenedor conserva la semántica para lectores de pantalla y tests. */}
      <View accessible accessibilityRole="list">
        <FlatList
          data={candidates}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const checked = selectedKeys.has(item.key) && !item.alreadyImported;
            return (
              <Pressable
                style={[styles.row, item.alreadyImported && styles.rowDisabled]}
                disabled={item.alreadyImported}
                accessibilityRole="checkbox"
                accessibilityLabel={`Cumpleaños de ${item.name}`}
                accessibilityState={{ checked, disabled: item.alreadyImported }}
                onPress={() => toggle(item.key)}
              >
                <Ionicons
                  name={item.alreadyImported ? 'checkmark-done-circle' : checked ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={item.alreadyImported ? '#bbb' : checked ? '#208AEF' : '#999'}
                />
                <View style={styles.rowBody}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.rowDate} numberOfLines={1}>
                    {item.alreadyImported ? 'Ya está en tu agenda' : formatLongDate(item.date)}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      </View>

      <Pressable
        style={[styles.importButton, !canImport && styles.importButtonDisabled]}
        disabled={!canImport}
        accessibilityRole="button"
        accessibilityLabel={
          importing
            ? 'Importando cumpleaños'
            : selected.length === 1
              ? 'Importar 1 cumpleaños'
              : `Importar ${selected.length} cumpleaños`
        }
        accessibilityState={{ disabled: !canImport, busy: importing }}
        onPress={() => onImport(selected)}
      >
        <Text style={styles.importText}>
          {importing
            ? 'Importando…'
            : selected.length === 1
              ? 'Importar 1 cumpleaños'
              : `Importar ${selected.length} cumpleaños`}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { padding: 16, gap: 8, paddingBottom: 96 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
  },
  rowDisabled: { opacity: 0.55 },
  rowBody: { flex: 1, gap: 2 },
  rowName: { fontSize: 16, fontWeight: '600', color: '#1a1a2e' },
  rowDate: { fontSize: 13, color: '#777' },
  importButton: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
    backgroundColor: '#208AEF',
    borderRadius: 24,
    padding: 15,
    alignItems: 'center',
  },
  importButtonDisabled: { opacity: 0.4 },
  importText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
