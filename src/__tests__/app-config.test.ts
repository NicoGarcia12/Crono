import appConfig from '../../app.json';
import easConfig from '../../eas.json';
import packageJson from '../../package.json';

const androidConfig = appConfig.expo.android as typeof appConfig.expo.android & {
  blockedPermissions?: readonly string[];
};

describe('configuración de Android', () => {
  it('bloquea WRITE_CONTACTS porque la importación solo lee contactos', () => {
    expect(androidConfig.blockedPermissions ?? []).toContain('android.permission.WRITE_CONTACTS');
  });

  it('bloquea RECORD_AUDIO aunque otra dependencia lo declare en su manifest', () => {
    expect(androidConfig.blockedPermissions ?? []).toContain('android.permission.RECORD_AUDIO');
    expect(androidConfig.permissions ?? []).not.toContain('android.permission.RECORD_AUDIO');
  });
});

describe('expo-image-picker', () => {
  const entry = appConfig.expo.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-image-picker',
  ) as [string, Record<string, string | boolean>] | undefined;

  it('desactiva el micrófono y conserva los textos de galería y cámara', () => {
    expect(entry?.[1].microphonePermission).toBe(false);
    expect(entry?.[1].photosPermission).toEqual(expect.any(String));
    expect(entry?.[1].cameraPermission).toEqual(expect.any(String));
  });
});

describe('versionado (CRONO43)', () => {
  it('mantiene la versión visible de la app igual a la del paquete', () => {
    expect(appConfig.expo.version).toBe(packageJson.version);
  });

  it('no define contadores nativos locales: el número de build es REMOTE de EAS', () => {
    expect('versionCode' in appConfig.expo.android).toBe(false);
    expect('ios' in appConfig.expo && 'buildNumber' in appConfig.expo.ios).toBe(false);
    expect(easConfig.cli.appVersionSource).toBe('remote');
  });

  it.each(['preview', 'production'] as const)('el perfil %s incrementa el build remoto', (profile) => {
    expect(easConfig.build[profile]).toHaveProperty('autoIncrement', true);
  });
});
