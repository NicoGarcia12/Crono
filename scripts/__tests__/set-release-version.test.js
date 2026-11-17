/** @jest-environment node */
const { spawnSync } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

const script = path.resolve(__dirname, '../set-release-version.cjs');
let directory;

function readJson(file) {
  return JSON.parse(readFileSync(path.join(directory, file), 'utf8'));
}

function runRelease(version) {
  return spawnSync(process.execPath, [script, version], { cwd: directory, encoding: 'utf8' });
}

beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), 'crono-release-'));
  const files = {
    'package.json': { name: 'crono', version: '1.0.0', dependencies: { expo: '^57.0.0' } },
    'package-lock.json': {
      name: 'crono', version: '1.0.0', lockfileVersion: 3,
      packages: {
        '': { name: 'crono', version: '1.0.0', dependencies: { expo: '^57.0.0' } },
        'node_modules/expo': { version: '57.0.0', integrity: 'locked-dependency' },
      },
    },
    'app.json': {
      expo: { version: '0.9.0', android: { package: 'com.nicogarcia12.crono' }, plugins: ['expo-router'] },
    },
  };
  for (const [file, content] of Object.entries(files)) {
    writeFileSync(path.join(directory, file), JSON.stringify(content));
  }
});

afterEach(() => rmSync(directory, { recursive: true, force: true }));

describe('corte de release desde la CLI', () => {
  it.each(['1.0.0', '1.2.3'])('sincroniza la versión %s sin modificar dependencias ni crear contadores nativos', (version) => {
    const result = runRelease(version);
    expect(result.status).toBe(0);
    expect(readJson('package.json')).toEqual({
      name: 'crono', version, dependencies: { expo: '^57.0.0' },
    });
    expect(readJson('package-lock.json')).toEqual({
      name: 'crono', version, lockfileVersion: 3,
      packages: {
        '': { name: 'crono', version, dependencies: { expo: '^57.0.0' } },
        'node_modules/expo': { version: '57.0.0', integrity: 'locked-dependency' },
      },
    });
    expect(readJson('app.json')).toEqual({
      expo: { version, android: { package: 'com.nicogarcia12.crono' }, plugins: ['expo-router'] },
    });
  });

  it('rechaza una versión inválida sin modificar archivos', () => {
    const before = readFileSync(path.join(directory, 'package.json'), 'utf8');
    expect(runRelease('v1.2.3').status).not.toBe(0);
    expect(readFileSync(path.join(directory, 'package.json'), 'utf8')).toBe(before);
    expect(readJson('app.json').expo.version).toBe('0.9.0');
  });

  it('lee todos los manifiestos antes de escribir para no cortar un release si app.json es inválido', () => {
    const beforePackage = readFileSync(path.join(directory, 'package.json'), 'utf8');
    const beforeLock = readFileSync(path.join(directory, 'package-lock.json'), 'utf8');
    writeFileSync(path.join(directory, 'app.json'), '{invalid');
    expect(runRelease('1.2.3').status).not.toBe(0);
    expect(readFileSync(path.join(directory, 'package.json'), 'utf8')).toBe(beforePackage);
    expect(readFileSync(path.join(directory, 'package-lock.json'), 'utf8')).toBe(beforeLock);
  });
});
