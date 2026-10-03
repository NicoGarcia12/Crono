import { Alert, Platform } from 'react-native';

/**
 * Confirmación destructiva que funciona igual en el celular y en web.
 *
 * 💡 Gotcha: en react-native-web `Alert.alert` no muestra nada, así que en
 * web se usa el `confirm` del navegador.
 */
export function confirmDestructive(title: string, message: string, confirmLabel: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(globalThis.confirm?.(`${title}\n\n${message}`) ?? false);
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

/** "Afecta a 3 eventos: 3 ideas de regalo y 2 valores de «Obra social»." */
export function impactMessage(impact: { events: number; items: { label: string; count: number }[] }): string {
  const parts = impact.items.map((item) => `${item.count} ${item.label}`);
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}` : parts[0];
  const events = `${impact.events} ${impact.events === 1 ? 'evento' : 'eventos'}`;
  return `Afecta a ${events}: se borran ${list}. No se puede deshacer.`;
}
