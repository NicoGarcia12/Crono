import { requireOptionalNativeModule } from 'expo';

interface CronoContactAccountsModule {
  /** Ids (`Contacts._ID`) de los contactos que viven en una cuenta de Google. */
  getGoogleContactIds(): Promise<string[]>;
}

/** `null` si el módulo nativo no está (web, Expo Go, iOS): no hay filtro disponible. */
export default requireOptionalNativeModule<CronoContactAccountsModule>('CronoContactAccounts');
