import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { describeRestore } from '@/backup/backup';
import { confirmAction, notify, showError } from '@/components/confirm';
import { MyBirthdayCard } from '@/components/my-birthday-card';
import { PhotoPicker } from '@/components/photo-picker';
import {
  getNotificationPermissionState,
  remindersAvailable,
  type NotificationPermissionState,
} from '@/notifications/notifications';
import { explainAndRequestNotificationPermission } from '@/notifications/permission-prompt';
import { useAppDispatch, useAppSelector } from '@/store';
import { exportBackup, restoreBackup } from '@/store/backup-slice';
import { addEvent, editEvent } from '@/store/events-slice';
import {
  restartOnboardingTour,
  saveDisplayName,
  savePhotoUri,
  saveThemePreference,
} from '@/store/settings-slice';
import { THEME_LABELS, THEME_PREFERENCES, type ThemeColors } from '@/theme/theme';
import { MY_BIRTHDAY_TYPE_KEY } from '@/types';
import { useThemeColors } from '@/theme/use-theme';

/** Perfil: nombre del usuario, resumen de datos y cómo funciona la app. */
export default function PerfilScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const dispatch = useAppDispatch();
  const router = useRouter();
  const displayName = useAppSelector((state) => state.settings.displayName);
  const themePreference = useAppSelector((state) => state.settings.themePreference);
  const photoUri = useAppSelector((state) => state.settings.photoUri);
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
          data: {
            ...myBirthday,
            title,
            date: isoDate,
            reminders: myBirthday.reminders,
            tags: myBirthday.tags.map((tag) => tag.name),
          },
          previousReminders: myBirthday.reminders,
        }),
      ).unwrap();
      return;
    }

    await dispatch(
      addEvent({
        title,
        type: MY_BIRTHDAY_TYPE_KEY,
        date: isoDate,
        time: null,
        description: null,
        contactId: null,
        phone: null,
        reminders: [{ amount: 1, unit: 'dias' }],
        yearly: 1,
        isMine: 1,
        tags: [],
        photoUri: null,
        yearUnknown: 0,
      }),
    ).unwrap();
  };

  const handleExport = async () => {
    // Se pregunta cada vez, antes de abrir Compartir / descargar: el archivo es JSON
    // legible, sin contraseña, y puede terminar en cualquier lado.
    const accepted = await confirmAction(
      'Tu copia se puede leer',
      'Tu copia va a ser accesible para cualquiera que la tenga: el archivo no tiene contraseña. ' +
        'Guardala en un lugar privado y no la mandes por chat ni la adjuntes en un reporte.',
      'Exportar',
    );
    if (!accepted) return;
    try {
      await dispatch(exportBackup()).unwrap();
    } catch {
      notify('No se pudo exportar', 'Intentá de nuevo en un momento.');
    }
  };

  /** "?" → vuelve a abrir el recorrido guiado, que vive en Agenda. */
  const handleShowTour = () => {
    void dispatch(restartOnboardingTour());
    router.navigate('/');
  };

  const handleRestore = async () => {
    try {
      const summary = await dispatch(restoreBackup()).unwrap();
      if (!summary) return; // el usuario canceló

      const { title, message } = describeRestore(summary);
      notify(title, message);
    } catch (error) {
      // Un string es un rechazo de parseBackup (archivo inválido). Cualquier otra
      // cosa es una falla al restaurar: se muestra su mensaje en vez de culpar al archivo.
      if (typeof error === 'string') {
        notify('No se pudo restaurar', error);
        return;
      }
      console.error('Falló la restauración del backup', error);
      const detail = (error as { message?: string } | null)?.message;
      notify('No se pudo restaurar', detail ? `Error al restaurar: ${detail}` : 'Error inesperado al restaurar.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PhotoPicker
        uri={photoUri}
        onChange={async (uri) => { await dispatch(savePhotoUri(uri)).unwrap(); }}
        accessibilityLabel="Elegir foto de perfil"
        size={88}
      />

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
        accessibilityRole="button"
        accessibilityLabel="Cargar cumpleaños de contactos"
        onPress={() => router.push('/cargar-cumpleanos')}
      >
        <View style={styles.actionIcon}>
          <Ionicons name="people" size={22} color={colors.danger} />
        </View>
        <View style={styles.actionBody}>
          <Text style={styles.actionTitle}>Cargar cumpleaños de contactos</Text>
          <Text style={styles.actionSubtitle}>
            {Platform.OS === 'web'
              ? 'La importación requiere la app instalada en Android o iOS. En web podés crear cumpleaños desde Agenda → +'
              : 'Elegí a quiénes de tu agenda querés cargarles el cumpleaños'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSubtle} />
      </Pressable>

      <ActionCard
        icon="pricetags"
        color={colors.primary}
        title="Tipos de evento"
        subtitle="Creá tipos y bases propios, con capacidades y campos extra"
        onPress={() => router.push('/tipos-evento')}
      />

      <ActionCard
        icon="cloud-upload"
        color={colors.primary}
        title="Exportar copia de seguridad"
        subtitle={Platform.OS === 'web'
          ? 'Descargá un archivo con tus eventos, notas, tipos y saludos. Cualquiera que lo tenga puede leerlo: guardalo en un lugar privado y no lo mandes por chat. No incluye fotos ni ideas de regalo'
          : 'Guardá un archivo con tus eventos, notas, tipos y saludos. Cualquiera que lo tenga puede leerlo: guardalo en un lugar privado y no lo mandes por chat. No incluye fotos ni ideas de regalo'}
        onPress={handleExport}
      />

      <ActionCard
        icon="cloud-download"
        color={colors.success}
        title="Restaurar desde un archivo"
        subtitle={Platform.OS === 'web'
          ? 'Elegí una copia guardada en tu equipo. No se duplica lo que ya tenés'
          : 'Traé tu agenda desde una copia. No se duplica lo que ya tenés'}
        onPress={handleRestore}
      />

      {/* Solo donde Crono programa recordatorios (no en web ni en Expo Go Android). */}
      {remindersAvailable ? <NotificationsRow /> : null}

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
        <InfoRow
          icon="lock-closed"
          text={Platform.OS === 'web'
            ? 'La versión web no tiene bloqueo local: cualquier persona con acceso a este navegador puede ver tus datos.'
            : 'La app pide la huella, cara o credencial de tu celular al abrirse y al volver después de más de 2 minutos fuera. Sin credencial del sistema, necesitás configurar una para entrar.'}
        />
        {Platform.OS === 'ios' ? (
          <InfoRow
            icon="information-circle"
            text="Para probar Face ID, usá un development build o la app instalada de Crono: Expo Go en iOS no lo admite."
          />
        ) : null}
        <InfoRow
          icon="phone-portrait"
          text={Platform.OS === 'web'
            ? 'Tus datos se guardan en este navegador. No se suben a un servidor ni se sincronizan con tu celular. Exportá una copia antes de borrar los datos del sitio.'
            : 'Tus datos se guardan en este celular (SQLite local) y Crono no los sube a ningún servidor. Lo que exportes o compartas sale del celular, y la copia de seguridad del sistema puede incluir los datos de la app.'}
        />
        {remindersAvailable ? (
          <InfoRow
            icon="notifications"
            text="Si autorizás las notificaciones, los recordatorios locales pueden avisarte sin internet y con la app cerrada. Igual dependen del permiso y de la configuración del celular: no uses Crono como único aviso para algo importante."
          />
        ) : null}
        {!remindersAvailable ? (
          <InfoRow
            icon="warning"
            danger
            text={Platform.OS === 'web'
              ? 'Crono web no envía recordatorios. Podés guardar anticipaciones como referencia. Para recibir avisos, usá la app instalada en Android o iOS y creá o editá allí tus eventos.'
              : 'Esta versión de Crono no programa recordatorios en Expo Go para Android. Usá un development build o la app instalada, permití las notificaciones y creá o editá allí tus eventos.'}
          />
        ) : null}
      </View>

      {/* Va al final para quedar por encima del resto; se ubica arriba a la derecha. */}
      <Pressable
        style={({ pressed }) => [styles.helpButton, pressed && styles.helpButtonPressed]}
        accessibilityRole="button"
        accessibilityLabel="Ver recorrido de la app"
        hitSlop={8}
        onPress={handleShowTour}
      >
        <Ionicons name="help-circle-outline" size={30} color={colors.primary} />
      </Pressable>
    </ScrollView>
  );
}

/** Qué dice la fila "Avisos" según el permiso (el label es lo que lee el lector de pantalla). */
const PERMISSION_COPY: Record<NotificationPermissionState, { subtitle: string; label: string }> = {
  granted: {
    subtitle: 'Activados. Crono puede avisarte de tus eventos aunque la app esté cerrada.',
    label: 'Avisos: activados',
  },
  askable: {
    subtitle: 'Sin permiso todavía. Tocá para permitir que Crono te avise de tus eventos.',
    label: 'Avisos: sin permiso todavía. Tocá para permitirlos',
  },
  blocked: {
    subtitle: 'Bloqueados en los ajustes del celular. Tocá para abrirlos y permitir las notificaciones de Crono.',
    label: 'Avisos: bloqueados en los ajustes del celular. Tocá para abrirlos',
  },
};

/**
 * Fila "Avisos" (CRONO44): el permiso de notificaciones ya no se pide al abrir
 * la app, así que quien actualizó o lo negó necesita un lugar para activarlo.
 *  - Se puede pedir → el mismo diálogo explicativo de la bienvenida y el pedido.
 *  - Bloqueado (el SO ya no pregunta) → abre los ajustes del sistema.
 *  - Concedido → solo informa.
 *
 * 💡 Aprendizaje: el permiso puede cambiar fuera de Crono (en Ajustes), así que
 * se vuelve a leer al entrar a la pantalla (`useFocusEffect`) y cuando la app
 * vuelve a primer plano (`AppState` → 'active').
 */
function NotificationsRow() {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [permission, setPermission] = useState<NotificationPermissionState | null>(null);

  // useCallback: useFocusEffect exige una función estable (si no, correría en cada render).
  const refresh = useCallback(() => {
    getNotificationPermissionState()
      .then(setPermission)
      .catch((error: unknown) => console.warn('No se pudo leer el permiso de notificaciones', error));
  }, []);

  useFocusEffect(refresh);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove(); // cleanup obligatorio de listeners nativos
  }, [refresh]);

  const handlePress = async () => {
    if (permission === 'blocked') {
      try {
        await Linking.openSettings();
      } catch (error) {
        showError('No se pudieron abrir los ajustes', error);
      }
      return;
    }
    if (permission === 'askable') {
      await explainAndRequestNotificationPermission();
      refresh();
    }
  };

  const actionable = permission === 'askable' || permission === 'blocked';
  const copy = permission
    ? PERMISSION_COPY[permission]
    : { subtitle: 'Revisando el permiso…', label: 'Avisos: revisando el permiso' };
  const iconColor =
    permission === 'granted' ? colors.success : permission === 'blocked' ? colors.danger : colors.primary;

  return (
    <Pressable
      style={styles.actionCard}
      accessibilityRole="button"
      accessibilityLabel={copy.label}
      accessibilityState={{ disabled: !actionable }}
      disabled={!actionable}
      onPress={() => void handlePress()}
    >
      <View style={[styles.actionIcon, { backgroundColor: `${iconColor}22` }]}>
        <Ionicons name={permission === 'granted' ? 'notifications' : 'notifications-off'} size={22} color={iconColor} />
      </View>
      <View style={styles.actionBody}>
        <Text style={styles.actionTitle}>Avisos</Text>
        <Text style={styles.actionSubtitle}>{copy.subtitle}</Text>
      </View>
      {actionable ? <Ionicons name="chevron-forward" size={20} color={colors.textSubtle} /> : null}
    </Pressable>
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
    <Pressable style={styles.actionCard} accessibilityRole="button" accessibilityLabel={title} onPress={onPress}>
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
  helpButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpButtonPressed: { backgroundColor: c.surfaceAlt },
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
