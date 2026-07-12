import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text } from 'react-native';
import type { EventItem } from '@/types';
import { canGreet, whatsappUrl } from '@/utils/whatsapp';
import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Botón "Saludar por WhatsApp": abre el chat de la persona con el saludo ya
 * escrito (se puede editar antes de enviarlo). Solo aparece en cumpleaños y
 * aniversarios que tengan teléfono.
 *
 * 💡 Aprendizaje: `Linking.openURL` le pasa el link al sistema operativo, que
 * decide qué app lo abre. Con wa.me, si WhatsApp está instalado abre la app; si
 * no, abre WhatsApp Web en el navegador.
 */
export function GreetButton({ event }: { event: EventItem }) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (!canGreet(event)) return null;

  const open = async () => {
    const url = whatsappUrl(event);
    if (!url) return;

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        'No se pudo abrir WhatsApp',
        'Revisá que el número esté bien escrito (con código de país) o que tengas WhatsApp instalado.',
      );
    }
  };

  return (
    <Pressable style={styles.button} accessibilityLabel="Saludar por WhatsApp" onPress={open}>
      <Ionicons name="logo-whatsapp" size={20} color="#fff" />
      <Text style={styles.text}>Saludar por WhatsApp</Text>
    </Pressable>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: c.whatsapp, // verde de WhatsApp
    borderRadius: 24,
    paddingVertical: 13,
    marginHorizontal: 16,
    marginTop: 12,
  },
  text: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
