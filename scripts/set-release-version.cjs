const { readFileSync, writeFileSync } = require('node:fs');

const version = process.argv[2];
if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version ?? '')) {
  throw new Error('Uso: npm run release:version -- X.Y.Z (versión estable sin prefijo v)');
}

// Leer y validar los tres archivos antes de escribir evita publicar un corte
// con package actualizado pero una configuración Expo ausente o inválida.
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const app = JSON.parse(readFileSync('app.json', 'utf8'));
if (!app.expo || !lock.packages?.['']) {
  throw new Error('Se requieren app.json con expo y package-lock.json con el paquete raíz');
}

packageJson.version = version;
lock.version = version;
lock.packages[''].version = version;
app.expo.version = version;

// Sólo cambia la versión visible. versionCode/buildNumber pertenecen a EAS
// REMOTE y no deben volver a convertirse en contadores locales de Git.
for (const [file, content] of [
  ['package.json', packageJson],
  ['package-lock.json', lock],
  ['app.json', app],
]) {
  writeFileSync(file, `${JSON.stringify(content, null, 2)}\n`);
}
