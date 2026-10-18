import * as Contacts from 'expo-contacts';
import { Platform } from 'react-native';

import cronoContactAccounts from '../../modules/crono-contact-accounts';

/**
 * Qué contactos se consideran "propios": los de la cuenta de Google en Android,
 * y los de las cuentas iCloud y Google (ambas CardDAV) en iOS. Se dejan afuera los
 * del almacenamiento del teléfono, la SIM, WhatsApp, etc., donde quedan contactos
 * viejos que ya se borraron de la cuenta.
 *
 * 💡 Aprendizaje: expo-contacts no filtra por cuenta en Android (los "Container" son
 * solo de iOS), por eso Android usa un módulo nativo propio (modules/crono-contact-accounts).
 *
 * Devuelve los ids permitidos, o `null` si no se puede filtrar (en ese caso se
 * muestran todos: mejor una lista de más que una pantalla vacía).
 */
export async function fetchAllowedContactIds(): Promise<Set<string> | null> {
  try {
    if (Platform.OS === 'android') {
      if (!cronoContactAccounts) return null;
      return new Set(await cronoContactAccounts.getGoogleContactIds());
    }
    if (Platform.OS === 'ios') return await fetchIosCloudContactIds();
  } catch (error) {
    console.warn('No se pudo filtrar los contactos por cuenta', error);
  }
  return null;
}

/** iOS: iCloud y Gmail son contenedores 'cardDAV'; 'local' y 'exchange' quedan afuera. */
async function fetchIosCloudContactIds(): Promise<Set<string> | null> {
  const ids = new Set<string>();
  let foundCloudContainer = false;
  for (const container of await Contacts.Container.getAll()) {
    if ((await container.getType()) !== 'cardDAV') continue;
    foundCloudContainer = true;
    for (const contact of await container.getContacts()) ids.add(contact.id);
  }
  return foundCloudContainer ? ids : null;
}
