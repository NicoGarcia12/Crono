import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAppDispatch, useAppSelector } from '@/store';
import { saveDisplayName } from '@/store/settings-slice';

/** Perfil: nombre del usuario, resumen de datos y cómo funciona la app. */
export default function PerfilScreen() {
  const dispatch = useAppDispatch();
  const displayName = useAppSelector((state) => state.settings.displayName);
  const eventCount = useAppSelector((state) => state.events.items.length);
  const noteCount = useAppSelector((state) => state.notes.items.length);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(displayName ?? '');

  const save = () => {
    if (name.trim().length === 0) return;
    dispatch(saveDisplayName(name));
    setEditing(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.avatar}>
        <Ionicons name="person" size={44} color="#208AEF" />
      </View>

      {editing ? (
        <View style={styles.editRow}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={save}
          />
          <Pressable style={styles.saveButton} onPress={save}>
            <Text style={styles.saveText}>Guardar</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.nameRow} onPress={() => setEditing(true)}>
          <Text style={styles.name}>{displayName}</Text>
          <Ionicons name="pencil" size={16} color="#999" />
        </Pressable>
      )}

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{eventCount}</Text>
          <Text style={styles.statLabel}>Eventos</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{noteCount}</Text>
          <Text style={styles.statLabel}>Notas</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <InfoRow icon="lock-closed" text="La app se bloquea al salir y se desbloquea con la huella, cara o PIN de tu celular." />
        <InfoRow icon="phone-portrait" text="Todos tus datos viven solo en este celular (SQLite local). No se suben a ningún servidor." />
        <InfoRow icon="notifications" text="Los recordatorios son notificaciones locales: funcionan sin internet, incluso con la app cerrada." />
      </View>
    </ScrollView>
  );
}

function InfoRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={20} color="#208AEF" />
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa' },
  content: { alignItems: 'center', padding: 24, gap: 16 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#208AEF22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 24, fontWeight: '700', color: '#1a1a2e' },
  editRow: { flexDirection: 'row', gap: 8, alignItems: 'center', alignSelf: 'stretch' },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: '#1a1a2e',
  },
  saveButton: { backgroundColor: '#208AEF', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
  saveText: { color: '#fff', fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 12, alignSelf: 'stretch' },
  statBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 2,
  },
  statNumber: { fontSize: 26, fontWeight: '700', color: '#208AEF' },
  statLabel: { fontSize: 13, color: '#777' },
  infoCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 14, alignSelf: 'stretch' },
  infoRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  infoText: { flex: 1, fontSize: 13.5, color: '#555', lineHeight: 19 },
});
