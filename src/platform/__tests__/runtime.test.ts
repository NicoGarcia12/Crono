import { Platform } from 'react-native';

import { showError } from '@/components/confirm';
import {
  CAPABILITIES,
  type Capability,
  isAvailable,
  logUnavailable,
  reportUnavailable,
  runtime,
  unavailableMessage,
} from '@/platform/runtime';

/**
 * Servicio de entorno y capacidades: una sola tabla decide qué funciona en
 * web, Expo Go y app instalada, y cómo se avisa lo que no.
 *
 * 💡 Aprendizaje: `Platform.OS` y `Constants.executionEnvironment` son valores
 * de módulo, no funciones: para simular cada entorno se reasignan antes de
 * consultar al servicio (por eso el servicio los lee en cada llamada y no al
 * importarse). `expo-constants` se mockea entero porque jest-expo no le pone
 * valor a `executionEnvironment`.
 */

type MockExecutionEnvironment = 'storeClient' | 'standalone' | 'bare';
let mockExecutionEnvironment: MockExecutionEnvironment = 'standalone';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get executionEnvironment() {
      return mockExecutionEnvironment;
    },
  },
  ExecutionEnvironment: { Bare: 'bare', Standalone: 'standalone', StoreClient: 'storeClient' },
}));
jest.mock('@/components/confirm', () => ({ showError: jest.fn() }));

const originalOS = Platform.OS;
let warn: jest.SpyInstance;

type Scenario = { os: typeof Platform.OS; env: MockExecutionEnvironment };

const SCENARIOS: Record<
  'web' | 'expo-go-android' | 'expo-go-ios' | 'native-android' | 'native-ios',
  Scenario
> = {
  web: { os: 'web', env: 'bare' },
  'expo-go-android': { os: 'android', env: 'storeClient' },
  'expo-go-ios': { os: 'ios', env: 'storeClient' },
  'native-android': { os: 'android', env: 'standalone' },
  'native-ios': { os: 'ios', env: 'standalone' },
};

function enter(scenario: keyof typeof SCENARIOS): void {
  Platform.OS = SCENARIOS[scenario].os;
  mockExecutionEnvironment = SCENARIOS[scenario].env;
}

beforeEach(() => {
  jest.clearAllMocks();
  warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  Platform.OS = originalOS;
  warn.mockRestore();
});

describe('runtime', () => {
  it.each([
    ['web', 'web'],
    ['expo-go-android', 'expo-go'],
    ['expo-go-ios', 'expo-go'],
    ['native-android', 'native'],
    ['native-ios', 'native'],
  ] as const)('en %s detecta kind=%s', (scenario, kind) => {
    enter(scenario);
    expect(runtime.kind).toBe(kind);
    expect(runtime.os).toBe(SCENARIOS[scenario].os);
  });

  it('se recalcula al cambiar de entorno (no queda congelado al importar)', () => {
    enter('native-android');
    expect(runtime.kind).toBe('native');
    enter('web');
    expect(runtime.kind).toBe('web');
  });
});

describe('isAvailable', () => {
  // Fila por entorno, columna por capacidad: la tabla completa que reemplaza a los
  // `Platform.OS === 'web'` sueltos que había en cada módulo.
  it.each<[keyof typeof SCENARIOS, Record<Capability, boolean>]>([
    ['web', { reminders: false, contacts: false, photos: false, localLock: false }],
    ['expo-go-android', { reminders: false, contacts: true, photos: true, localLock: true }],
    ['expo-go-ios', { reminders: true, contacts: true, photos: true, localLock: true }],
    ['native-android', { reminders: true, contacts: true, photos: true, localLock: true }],
    ['native-ios', { reminders: true, contacts: true, photos: true, localLock: true }],
  ])('en %s', (scenario, expected) => {
    enter(scenario);
    const actual = Object.fromEntries(CAPABILITIES.map((c) => [c, isAvailable(c)]));
    expect(actual).toEqual(expected);
  });
});

describe('unavailableMessage', () => {
  it.each(CAPABILITIES)('%s: texto en español sin nombrar la plataforma', (capability) => {
    const message = unavailableMessage(capability);
    expect(message).toMatch(/\.$/);
    expect(message).not.toMatch(/\b(web|expo go|navegador|android|ios)\b/i);
  });
});

describe('logUnavailable', () => {
  it('escribe el mensaje y el entorno en consola, sin diálogo', () => {
    enter('web');

    logUnavailable('contacts');

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(unavailableMessage('contacts'), {
      capability: 'contacts',
      runtime: 'web',
    });
    expect(showError).not.toHaveBeenCalled();
  });

  it('anota el entorno real, no siempre web', () => {
    enter('expo-go-android');

    logUnavailable('reminders');

    expect(warn).toHaveBeenCalledWith(
      unavailableMessage('reminders'),
      expect.objectContaining({ runtime: 'expo-go' }),
    );
  });
});

describe('reportUnavailable', () => {
  it('loguea y muestra el diálogo con el mismo mensaje', () => {
    enter('web');

    reportUnavailable('photos', 'No se pudo elegir la foto');

    const message = unavailableMessage('photos');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(message, { capability: 'photos', runtime: 'web' });
    expect(showError).toHaveBeenCalledTimes(1);
    expect(showError).toHaveBeenCalledWith('No se pudo elegir la foto', message);
  });
});
