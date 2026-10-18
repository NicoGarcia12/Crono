import { useMemo, useSyncExternalStore } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  currentDialog,
  resolveDialog,
  subscribeDialogs,
  type DialogButton,
  type DialogRequest,
} from '@/components/confirm';
import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Muestra los diálogos pedidos con `confirmAction`, `confirmDestructive`,
 * `notify` y `showError`. Va montado una sola vez en el layout raíz.
 *
 * 💡 Aprendizaje: `useSyncExternalStore` es la forma de React de leer un store
 * que vive fuera de React (acá, la cola de `confirm.ts`) y re-renderizar
 * cuando cambia, sin Context ni Redux.
 */
export function DialogHost() {
  const dialog = useSyncExternalStore(subscribeDialogs, currentDialog, currentDialog);
  if (!dialog) return null;
  // `key`: si llega otro diálogo en cola, se monta de cero (sin estado viejo).
  return <DialogView key={dialog.id} dialog={dialog} />;
}

/** El botón "atrás" de Android y tocar fuera cancelan, como con `Alert.alert`. */
function dismissValue(buttons: DialogButton[]): boolean {
  return buttons.find((b) => b.style === 'cancel')?.value ?? buttons[0]?.value ?? false;
}

function DialogView({ dialog }: { dialog: DialogRequest }) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const dismiss = () => resolveDialog(dialog.id, dismissValue(dialog.buttons));

  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={dismiss}>
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismiss}
          accessible={false}
          importantForAccessibility="no"
        />
        <View style={styles.card} accessibilityViewIsModal accessibilityRole="alert">
          <Text style={styles.title} accessibilityRole="header">
            {dialog.title}
          </Text>
          {dialog.message ? <Text style={styles.message}>{dialog.message}</Text> : null}
          <View style={styles.actions}>
            {dialog.buttons.map((button) => (
              <Pressable
                key={button.label}
                accessibilityRole="button"
                accessibilityLabel={button.label}
                onPress={() => resolveDialog(dialog.id, button.value)}
                style={({ pressed }) => [
                  styles.button,
                  button.style === 'cancel' && styles.cancelButton,
                  button.style === 'default' && styles.defaultButton,
                  button.style === 'destructive' && styles.destructiveButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.buttonText, button.style === 'cancel' && styles.cancelText]}>
                  {button.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      backgroundColor: 'rgba(5, 8, 22, 0.55)',
    },
    card: {
      width: '100%',
      maxWidth: 380,
      backgroundColor: c.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      padding: 20,
      gap: 10,
      shadowColor: c.shadow,
      shadowOpacity: 0.2,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    title: { fontSize: 18, fontWeight: '700', color: c.text },
    message: { fontSize: 15, lineHeight: 21, color: c.textMuted },
    actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
    button: { minWidth: 96, alignItems: 'center', borderRadius: 12, paddingVertical: 11, paddingHorizontal: 16 },
    cancelButton: { backgroundColor: c.surfaceAlt },
    defaultButton: { backgroundColor: c.primary },
    destructiveButton: { backgroundColor: c.danger },
    pressed: { opacity: 0.75 },
    buttonText: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
    cancelText: { color: c.text },
  });
