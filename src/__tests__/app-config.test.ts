import appConfig from '../../app.json';

const androidConfig = appConfig.expo.android as typeof appConfig.expo.android & {
  blockedPermissions?: readonly string[];
};

describe('configuración de Android', () => {
  it('bloquea WRITE_CONTACTS porque la importación solo lee contactos', () => {
    expect(androidConfig.blockedPermissions ?? []).toContain('android.permission.WRITE_CONTACTS');
  });
});
