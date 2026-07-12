import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAppDispatch, useAppSelector } from '@/store';
import { exportBackup, restoreBackup } from '@/store/backup-slice';
import { saveDisplayName } from '@/store/settings-slice';

/** Perfil: nombre del usuario, resumen de datos y cómo funciona la app. */
export default function PerfilScreen() {
  const dispatch = useAppDispatch();
  const router = useRouter();
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

  const handleExport = async () => {
    try {
      await dispatch(exportBackup()).unwrap();
    } catch {
      Alert.alert('No se pudo exportar', 'Intentá de nuevo en un momento.');
    }
  };

  const handleRestore = async () => {
    try {
      const summary = await dispatch(restoreBackup()).unwrap();
      if (!summary) return; // el usuario canceló

      const partes = [
        `${summary.events} ${summary.events === 1 ? 'evento' : 'eventos'}`,
        `${summary.notes} ${summary.notes === 1 ? 'nota' : 'notas'}`,
      ];
      const salteados = summary.skipped > 0 ? `\n${summary.skipped} ya estaban en tu agenda.` : '';
      Alert.alert('Listo', `Se restauraron ${partes.join(' y ')}.${salteados}`);
    } catch (error) {
      Alert.alert('No se pudo restaurar', typeof error === 'string' ? error : 'El archivo no es válido.');
    }
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

      <Pressable
        style={styles.actionCard}
        accessibilityLabel="Cargar cumpleaños de contactos"
        onPress={() => router.push('/cargar-cumpleanos')}
      >
        <View style={styles.actionIcon}>
          <Ionicons name="people" size={22} color="#E91E63" />
        </View>
        <View style={styles.actionBody}>
          <Text style={styles.actionTitle}>Cargar cumpleaños de contactos</Text>
          <Text style={styles.actionSubtitle}>
            Elegí a quiénes de tu agenda querés cargarles el cumpleaños
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#bbb" />
      </Pressable>

      <ActionCard
        icon="cloud-upload"
        color="#208AEF"
        title="Exportar copia de seguridad"
        subtitle="Guardá un archivo con tus eventos y notas (Drive, WhatsApp, donde quieras)"
        onPress={handleExport}
      />

      <ActionCard
        icon="cloud-download"
        color="#4CAF50"
        title="Restaurar desde un archivo"
        subtitle="Traé tu agenda desde una copia. No se duplica lo que ya tenés"
        onPress={handleRestore}
      />

      <View style={styles.infoCard}>
        <InfoRow icon="lock-closed" text="La app se bloquea al salir y se desbloquea con la huella, cara o PIN de tu celular." />
        <InfoRow icon="phone-portrait" text="Todos tus datos viven solo en este celular (SQLite local). No se suben a ningún servidor." />
        <InfoRow icon="notifications" text="Los recordatorios son notificaciones locales: funcionan sin internet, incluso con la app cerrada." />
      </View>
    </ScrollView>
  );
}

interface ActionCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}

/** Fila accionable del perfil (importar contactos, exportar, restaurar…). */
function ActionCard({ icon, color, title, subtitle, onPress }: ActionCardProps) {
  return (
    <Pressable style={styles.actionCard} accessibilityLabel={title} onPress={onPress}>
      <View style={[styles.actionIcon, { backgroundColor: `${color}22` }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View style={styles.actionBody}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#bbb" />
    </Pressable>
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
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    alignSelf: 'stretch',
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E91E6322',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBody: { flex: 1, gap: 2 },
  actionTitle: { fontSize: 15.5, fontWeight: '600', color: '#1a1a2e' },
  actionSubtitle: { fontSize: 12.5, color: '#777' },
  infoCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 14, alignSelf: 'stretch' },
  infoRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  infoText: { flex: 1, fontSize: 13.5, color: '#555', lineHeight: 19 },
});
