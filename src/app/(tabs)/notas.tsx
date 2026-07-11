import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppSelector } from '@/store';

/** Pestaña de notas personales, ordenadas por última modificación. */
export default function NotasScreen() {
  const router = useRouter();
  const notes = useAppSelector((state) => state.notes.items);

  return (
    <View style={styles.container}>
      <FlatList
        data={notes}
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
        contentContainerStyle={notes.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={56} color="#bbb" />
            <Text style={styles.emptyTitle}>Sin notas todavía</Text>
            <Text style={styles.emptyText}>Tocá el botón + para escribir tu primera nota.</Text>
          </View>
        }
      />
      <Pressable style={styles.fab} onPress={() => router.push('/nota/nueva')}>
        <Ionicons name="add" size={30} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa' },
  listContent: { paddingVertical: 8, paddingBottom: 96 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 5,
    gap: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  title: { fontSize: 16, fontWeight: '600', color: '#1a1a2e' },
  snippet: { fontSize: 14, color: '#777', lineHeight: 19 },
  date: { fontSize: 12, color: '#aaa', marginTop: 2 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 8, padding: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#555' },
  emptyText: { fontSize: 14, color: '#999', textAlign: 'center' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
