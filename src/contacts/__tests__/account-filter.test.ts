import * as Contacts from 'expo-contacts';
import { Platform } from 'react-native';

import { fetchAllowedContactIds } from '@/contacts/account-filter';

const mockGetGoogleContactIds = jest.fn();
let mockNativeModule: { getGoogleContactIds: jest.Mock } | null;

jest.mock('../../../modules/crono-contact-accounts', () => ({
  __esModule: true,
  get default() {
    return mockNativeModule;
  },
}));

jest.mock('expo-contacts', () => ({ Container: { getAll: jest.fn() } }));

const container = (type: string, ids: string[]) => ({
  getType: async () => type,
  getContacts: async () => ids.map((id) => ({ id })),
});

const withPlatform = async (os: 'android' | 'ios', run: () => Promise<void>) => {
  const original = Platform.OS;
  Platform.OS = os;
  try {
    await run();
  } finally {
    Platform.OS = original;
  }
};

beforeEach(() => {
  mockGetGoogleContactIds.mockReset();
  mockNativeModule = { getGoogleContactIds: mockGetGoogleContactIds };
});

describe('fetchAllowedContactIds', () => {
  it('Android: devuelve los ids de los contactos de la cuenta de Google', async () => {
    mockGetGoogleContactIds.mockResolvedValue(['1', '2']);

    await withPlatform('android', async () => {
      await expect(fetchAllowedContactIds()).resolves.toEqual(new Set(['1', '2']));
    });
  });

  it('Android: sin módulo nativo no filtra (null)', async () => {
    mockNativeModule = null;

    await withPlatform('android', async () => {
      await expect(fetchAllowedContactIds()).resolves.toBeNull();
    });
  });

  it('Android: si el módulo nativo falla no filtra (null) en vez de romper', async () => {
    mockGetGoogleContactIds.mockRejectedValue(new Error('boom'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    await withPlatform('android', async () => {
      await expect(fetchAllowedContactIds()).resolves.toBeNull();
    });
  });

  it('iOS: junta los contactos de los contenedores cardDAV (iCloud/Gmail) y deja afuera el resto', async () => {
    (Contacts.Container.getAll as jest.Mock).mockResolvedValue([
      container('cardDAV', ['a', 'b']),
      container('local', ['c']),
      container('exchange', ['d']),
    ]);

    await withPlatform('ios', async () => {
      await expect(fetchAllowedContactIds()).resolves.toEqual(new Set(['a', 'b']));
    });
  });

  it('iOS: si no hay ningún contenedor cardDAV no filtra (null)', async () => {
    (Contacts.Container.getAll as jest.Mock).mockResolvedValue([container('local', ['c'])]);

    await withPlatform('ios', async () => {
      await expect(fetchAllowedContactIds()).resolves.toBeNull();
    });
  });
});
