import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { MyBirthdayCard } from '@/components/my-birthday-card';
import { remindersAvailable } from '@/notifications/notifications';
import { useAppDispatch, useAppSelector } from '@/store';
import { exportBackup, restoreBackup } from '@/store/backup-slice';
import { addEvent, editEvent } from '@/store/events-slice';
import { saveDisplayName, saveThemePreference } from '@/store/settings-slice';
import { THEME_LABELS, THEME_PREFERENCES, type ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';

/** Perfil: nombre del usuario, resumen de datos y cómo funciona la app. */
export default function PerfilScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const dispatch = useAppDispatch();
  const router = useRouter();
  const displayName = useAppSelector((state) => state.settings.displayName);
  const themePreference = useAppSelector((state) => state.settings.themePreference);
  const events = useAppSelector((state) => state.events.items);
  const eventCount = events.length;
  const noteCount = useAppSelector((state) => state.notes.items.length);

  const myBirthday = events.find((event) => event.isMine === 1);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(displayName ?? '');

  const save = () => {
    if (name.trim().length === 0) return;
    dispatch(saveDisplayName(name));
    setEditing(false);
  };

  /**
   * Mi cumpleaños se carga acá una sola vez: la app crea (o actualiza) el
   * evento en la agenda, marcado como propio. Desde su detalle —o desde el
   * botón de esta misma tarjeta— se lleva la lista de quién me saludó.
   */
  const handleSaveMyBirthday = async (isoDate: string) => {
    const title = displayName ? `Cumpleaños de ${displayName}` : 'Mi cumpleaños';

    if (myBirthday) {
      await dispatch(
        editEvent({
          id: myBirthday.id,
          data: { ...myBirthday, title, date: isoDate, reminders: myBirthday.reminders },
          previousReminders: myBirthday.reminders,
        }),
      ).unwrap();
      return;
    }

    await dispatch(
      addEvent({
        title,
        type: 'cumpleanos',
        date: isoDate,
        time: null,
        description: null,
        contactId: null,
        phone: null,
        reminders: [{ amount: 1, unit: 'dias' }],
        yearly: 1,
        isMine: 1,
      }),
    ).unwrap();
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
        <Ionicons name="person" size={44} color={colors.primary} />
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
          <Ionicons name="pencil" size={16} color={colors.textSubtle} />
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

      <MyBirthdayCard
        event={myBirthday}
        onSave={handleSaveMyBirthday}
        onOpenGreetings={() => router.push('/saludos')}
      />

      <Pressable
        style={styles.actionCard}
        accessibilityLabel="Cargar cumpleaños de contactos"
        onPress={() => router.push('/cargar-cumpleanos')}
      >
        <View style={styles.actionIcon}>
          <Ionicons name="people" size={22} color={colors.danger} />
        </View>
        <View style={styles.actionBody}>
          <Text style={styles.actionTitle}>Cargar cumpleaños de contactos</Text>
          <Text style={styles.actionSubtitle}>
            Elegí a quiénes de tu agenda querés cargarles el cumpleaños
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSubtle} />
      </Pressable>

      <ActionCard
        icon="cloud-upload"
        color={colors.primary}
        title="Exportar copia de seguridad"
        subtitle="Guardá un archivo con tus eventos y notas (Drive, WhatsApp, donde quieras)"
        onPress={handleExport}
      />

      <ActionCard
        icon="cloud-download"
        color={colors.success}
        title="Restaurar desde un archivo"
        subtitle="Traé tu agenda desde una copia. No se duplica lo que ya tenés"
        onPress={handleRestore}
      />

      {/* Tema: automático (sigue al celular), claro u oscuro. */}
      <View style={styles.themeCard}>
        <View style={styles.themeHeader}>
          <Ionicons name="moon" size={20} color={colors.primary} />
          <Text style={styles.themeTitle}>Tema</Text>
        </View>
        <View style={styles.themeRow}>
          {THEME_PREFERENCES.map((preference) => {
            const active = preference === themePreference;
            return (
              <Pressable
                key={preference}
                accessibilityLabel={`Tema ${THEME_LABELS[preference]}`}
                style={[styles.themeChip, active && styles.themeChipActive]}
                onPress={() => dispatch(saveThemePreference(preference))}
              >
                <Text style={[styles.themeChipText, active && styles.themeChipTextActive]}>
                  {THEME_LABELS[preference]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.infoCard}>
        <InfoRow icon="lock-closed" text="La app se bloquea al salir y se desbloquea con la huella, cara o PIN de tu celular." />
        <InfoRow icon="phone-portrait" text="Todos tus datos viven solo en este celular (SQLite local). No se suben a ningún servidor." />
        <InfoRow icon="notifications" text="Los recordatorios son notificaciones locales: funcionan sin internet, incluso con la app cerrada." />
        {!remindersAvailable ? (
          <InfoRow
            icon="warning"
            danger
            text="Estás en Expo Go: los recordatorios no se disparan acá. Instalá la app (APK) para recibirlos completos."
          />
        ) : null}
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
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Pressable style={styles.actionCard} accessibilityLabel={title} onPress={onPress}>
      <View style={[styles.actionIcon, { backgroundColor: `${color}22` }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View style={styles.actionBody}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textSubtle} />
    </Pressable>
  );
}

function InfoRow({
  icon,
  text,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  danger?: boolean;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.primary} />
      <Text style={[styles.infoText, danger && { color: colors.danger }]}>{text}</Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
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
  name: { fontSize: 24, fontWeight: '700', color: c.text },
  editRow: { flexDirection: 'row', gap: 8, alignItems: 'center', alignSelf: 'stretch' },
  input: {
    flex: 1,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: c.text,
  },
  saveButton: { backgroundColor: c.primary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
  saveText: { color: '#fff', fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 12, alignSelf: 'stretch' },
  statBox: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 2,
  },
  statNumber: { fontSize: 26, fontWeight: '700', color: c.primary },
  statLabel: { fontSize: 13, color: c.textMuted },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: c.surface,
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
  actionTitle: { fontSize: 15.5, fontWeight: '600', color: c.text },
  actionSubtitle: { fontSize: 12.5, color: c.textMuted },
  themeCard: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    alignSelf: 'stretch',
  },
  themeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  themeTitle: { fontSize: 15.5, fontWeight: '600', color: c.text },
  themeRow: { flexDirection: 'row', gap: 6 },
  themeChip: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 16,
    paddingVertical: 7,
  },
  themeChipActive: { backgroundColor: c.contrast, borderColor: c.contrast },
  themeChipText: { fontSize: 13, color: c.textMuted },
  themeChipTextActive: { color: '#fff', fontWeight: '600' },
  infoCard: { backgroundColor: c.surface, borderRadius: 14, padding: 16, gap: 14, alignSelf: 'stretch' },
  infoRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  infoText: { flex: 1, fontSize: 13.5, color: c.textMuted, lineHeight: 19 },
});
