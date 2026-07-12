import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { SearchField } from '@/components/search-field';
import { useAppSelector } from '@/store';
import { filterNotes } from '@/utils/search';
import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';

/** Pestaña de notas personales, ordenadas por última modificación. */
export default function NotasScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const router = useRouter();
  const notes = useAppSelector((state) => state.notes.items);
  const [query, setQuery] = useState('');

  const found = useMemo(() => filterNotes(notes, query), [notes, query]);

  return (
    <View style={styles.container}>
      <SearchField
        value={query}
        onChange={setQuery}
        label="Buscar notas"
        placeholder="Buscar en tus notas…"
      />

      <FlatList
        data={found}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push({ pathname: '/nota/[id]', params: { id: String(item.id) } })}
          >
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
            {item.content ? (
              <Text style={styles.snippet} numberOfLines={2}>
                {item.content}
              </Text>
            ) : null}
            <Text style={styles.date}>
              {new Date(item.updatedAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
          </Pressable>
        )}
        contentContainerStyle={found.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name={query ? 'search' : 'document-text-outline'} size={56} color={colors.textSubtle} />
            <Text style={styles.emptyTitle}>{query ? 'Sin resultados' : 'Sin notas todavía'}</Text>
            <Text style={styles.emptyText}>
              {query
                ? `Ninguna nota coincide con “${query}”.`
                : 'Tocá el botón + para escribir tu primera nota.'}
            </Text>
          </View>
        }
      />
      <Pressable
        style={styles.fab}
        accessibilityLabel="Agregar nota"
        onPress={() => router.push('/nota/nueva')}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </Pressable>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  listContent: { paddingVertical: 8, paddingBottom: 96 },
  card: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 5,
    gap: 4,
    elevation: 1,
    shadowColor: c.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  title: { fontSize: 16, fontWeight: '600', color: c.text },
  snippet: { fontSize: 14, color: c.textMuted, lineHeight: 19 },
  date: { fontSize: 12, color: c.textSubtle, marginTop: 2 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 8, padding: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: c.textMuted },
  emptyText: { fontSize: 14, color: c.textSubtle, textAlign: 'center' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: c.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
