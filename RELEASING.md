# Cómo se versiona y publica este proyecto

Este repo usa un flujo `develop` → `release` → `main`.

## Trabajo del día a día

Todo el trabajo (features, fixes) se ramifica y mergea contra `develop`. `main` está protegida: nadie puede pushear directo ni mergear sin que:

- Haya un Pull Request (no hace falta que nadie lo apruebe, pero sí que exista).
- Pase el check de CI: `test`.

## Cómo cortar un release

1. Andá a la pestaña **Actions** del repo → workflow **"Cut Release"** → botón **"Run workflow"** (rama: `develop`).
   - También se puede disparar por consola: `gh workflow run cut-release.yml --repo NicoGarcia12/Crono --ref develop`.
2. El workflow, solo:
   - Calcula la próxima versión mirando los commits desde el último tag (`feat` = minor, `fix` = patch, `BREAKING CHANGE` = major). **La primera release siempre es `1.0.0`**, sin importar qué diga el cálculo.
   - Crea la rama `release/X.Y.Z`, ya con el número puesto.
   - Genera/actualiza `CHANGELOG.md` (formato [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)), separado en `Added` / `Fixed` / `Changed` / etc.
   - Sincroniza la versión en `package.json`, las dos entradas raíz de `package-lock.json` y `expo.version` de `app.json` mediante `npm run release:version -- X.Y.Z`. No cambia versiones de dependencias.
   - Abre el PR `release/X.Y.Z → main`.
3. Revisá el PR (podés editar el `CHANGELOG.md` a mano si algo quedó raro) y mergealo cuando quieras.

## Qué pasa al mergear el release

Automático, sin que hagas nada más:

- Se crea el tag `vX.Y.Z`.
- Se publica el **Release** en GitHub con la sección nueva del changelog como notas.
- `main` se mergea de vuelta a `develop`, para que no se desincronicen.

## Versión visible y número de build (CRONO43)

Son dos datos distintos:

- **Versión visible**: `package.json.version` y `app.json.expo.version` siempre coinciden después del corte. En Android se convierte en `versionName`; podés verla en Ajustes → Aplicaciones → Crono. No se cambia por cada preview.
- **Número de build**: EAS es la única fuente de `android.versionCode` e `ios.buildNumber`, porque `cli.appVersionSource` es `remote`. `preview` y `production` usan `autoIncrement: true`; no agregues contadores a `app.json` ni uses `build:version:sync` como parte del corte.

El contador Android se comparte para el mismo proyecto/identificador `com.nicogarcia12.crono`, no es un contador independiente por perfil. Cada build preview nuevo debe tener un código mayor al anterior; puede haber saltos si hubo intentos fallidos u otros builds. El tag/release de GitHub sigue siendo automático al mergear una rama `release/`: no ejecuta EAS ni distribuye APKs.

Cada artefacto se identifica con su **commit**, **versión visible**, **perfil**, **ID de build EAS** y **versionCode**. Conservá el JSON de `eas build:view` junto a la evidencia de QA: los campos son `gitCommitHash`, `appVersion`, `buildProfile`, `id` y `appBuildVersion` (versionCode en Android). La URL de descarga sola no alcanza y puede vencer. Generá builds desde un commit aprobado y árbol limpio: cambios sin commit no quedan identificados sólo por el SHA.

### Preparar dos previews sin consumir builds todavía

Usá las dependencias locales (`npm ci`, Node LTS 24), una sesión Expo con acceso al proyecto y la misma clave de firma que el APK instalado. Consultá **sólo lectura**, desde la raíz del repo:

```powershell
npx eas-cli whoami
npx eas-cli account:usage nicogarcia12 --json --non-interactive
npx eas-cli build:version:get --platform android --profile preview --json --non-interactive
npx eas-cli build:list --platform android --build-profile preview --limit 2 --json --non-interactive
```

Si falta sesión, el usuario debe iniciar `npx eas-cli login`; no guardes credenciales en el repo. Antes de construir, confirmar explícitamente **entorno preview/pruebas**, **consumo de dos builds**, si se corre el **quality gate**, y **rollback**. No ejecutar `build:version:set` ni reiniciar el contador remoto.

Relevamiento de sólo lectura del 28/10/2026: cuenta Free, Android 3/15 builds usados (12 disponibles), total 3/30, período 01/10–01/11, sin sobreconsumo y estimación de facturación cero. Dos previews cabían en esa cuota; volvé a consultar antes de usarlos porque no es una reserva. El remoto Android era `1`. Los últimos builds `e873ffd4-5ef4-40e7-85f1-73ed35ed99da` y `173d3a1f-110e-4eab-8604-ffb694183f3c` tenían ambos versión `1.0.0` y código `1`, evidencia del problema; sus artefactos indicaban vencimiento en octubre. No se lanzaron builds ni se modificó el remoto durante la implementación.

### Construir y comprobar el upgrade (sólo con autorización)

En PowerShell, desde el commit aprobado, generar A y esperar que termine antes de generar B:

```powershell
$commit = git rev-parse HEAD
npm run build:apk -- --message "CRONO43 preview A commit=$commit" --wait
npm run build:apk -- --message "CRONO43 preview B commit=$commit" --wait
$buildAId = Read-Host "ID del build A terminado"
$buildBId = Read-Host "ID del build B terminado"
npx eas-cli build:view "$buildAId" --json
npx eas-cli build:view "$buildBId" --json
```

Descargá cada `artifacts.buildUrl` como `preview-A.apk` y `preview-B.apk`. Comprobar en ambos JSON: `FINISHED`, mismo `appIdentifier`, perfil `preview`, SHA aprobado y versión visible igual a package/app. Debe cumplirse `versionCode(B) > versionCode(A) > código previo`; no exigir que sean consecutivos. Compará también APK/firma con Android SDK Build Tools:

```powershell
apkanalyzer manifest application-id preview-A.apk
apkanalyzer manifest version-name preview-A.apk
apkanalyzer manifest version-code preview-A.apk
apkanalyzer manifest permissions preview-A.apk
apksigner verify --print-certs preview-A.apk
apkanalyzer manifest application-id preview-B.apk
apkanalyzer manifest version-name preview-B.apk
apkanalyzer manifest version-code preview-B.apk
apkanalyzer manifest permissions preview-B.apk
apksigner verify --print-certs preview-B.apk
adb devices
adb install -r preview-A.apk
adb shell dumpsys package com.nicogarcia12.crono
```

Abrí A, creá una nota y un evento de prueba, personalizá el perfil y cerrá la app. Instalá B **sin desinstalar ni borrar datos**:

```powershell
adb install -r preview-B.apk
adb shell dumpsys package com.nicogarcia12.crono
```

Debe instalarse con éxito, aumentar `versionCode`, mostrar la versión prevista en Ajustes y conservar nota, evento y perfil. Si A actualiza un APK ya instalado, también debe compartir su firma y tener un código mayor. No usar `-d` para permitir downgrades.

**Rollback**: conservar un backup exportado antes del smoke. Para volver al código anterior sin desinstalar, construir ese commit con la misma firma/identificador y un `versionCode` remoto **nuevo y mayor**, con aprobación de otro consumo de build. No bajar el contador ni reinstalar un APK viejo a la fuerza. Si el rollback de código requiere otro esquema de DB, revisar compatibilidad de migraciones antes de ejecutarlo; el backup no incluye fotos.

**Límite de evidencia**: sin Android SDK/JDK, adb, emulador o dispositivo no se valida un upgrade real. EAS puede producir APKs en la nube, pero eso no demuestra instalación, conservación de datos ni prompts del sistema. Expo Go y web tampoco validan los permisos del binario de Crono.

## Permisos de fotos sin micrófono (CRONO50)

Crono no graba audio. En Expo SDK 57, `expo-image-picker` agrega `RECORD_AUDIO` por defecto desde su plugin; `microphonePermission: false` lo bloquea en Android y elimina `NSMicrophoneUsageDescription` en iOS. Además `android.blockedPermissions` declara `android.permission.RECORD_AUDIO` explícitamente para impedir que un manifest de dependencia lo vuelva a incorporar. Se conservan `cameraPermission`, `photosPermission`, `CAMERA` y el selector de imágenes; no se agregan capacidades de audio ni video.

### QA de configuración y manifest

1. Desde la raíz, `npx expo config --type introspect --json`: revisar `_internal.modResults.android.manifest`. `RECORD_AUDIO` debe tener `tools:node="remove"`, no ser un permiso activo. En `_internal.modResults.ios.infoPlist` no debe existir `NSMicrophoneUsageDescription`; cámara y fotos conservan sus mensajes.
2. Crear una **copia temporal** de esta revisión y sus assets/módulos/configs, usando las mismas dependencias instaladas. Sólo dentro de esa copia ejecutar `npx expo prebuild --platform android --no-install`. No usar `--clean` ni generar `android/` sobre otro worktree. El prebuild puede necesitar red para obtener el template, pero no debe lanzar EAS.
3. Leer `android/app/src/main/AndroidManifest.xml`: comprobar el marcador de eliminación de audio y el resto de permisos. Un manifest fuente con ese marcador **no es** el manifest final fusionado de Gradle.
4. Con JDK/SDK disponibles, generar el manifest de release en la copia temporal (`android/gradlew.bat :app:processReleaseMainManifest` en Windows o `./gradlew :app:processReleaseMainManifest` desde `android/` en macOS/Linux) e inspeccionar el merged manifest y el informe del merger. No debe quedar un `uses-permission` activo de `RECORD_AUDIO`; sí cámara. Los permisos legacy de almacenamiento del picker pueden estar limitados a Android 12/API 32.
5. Sobre los APKs A/B, `apkanalyzer manifest permissions` no debe listar `android.permission.RECORD_AUDIO`. En una instalación de prueba nueva, iniciar Crono, elegir una foto y probar el acceso a cámara disponible sin prompt de micrófono; cancelar o negar fotos/cámara no debe romper la app. La UI actual abre galería, no agrega un botón nuevo de cámara. Para iOS revisar Info.plist del binario y probar en dispositivo: sin mensaje/permiso de micrófono, cámara/fotos conservados.

Cambiar JSON o publicar una actualización JS no quita permisos de un APK existente: hace falta un binario nuevo. Los tests de release se ejecutan con `npx jest scripts/__tests__/set-release-version.test.js --runInBand`, sobre fixtures temporales y sin modificar la versión del repo.

### Documentación oficial

- [SDK 57](https://docs.expo.dev/versions/v57.0.0/) y [ImagePicker 57: configuración y permisos](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/).
- [App config SDK 57](https://docs.expo.dev/versions/v57.0.0/config/app/) y [bloqueo de permisos Android](https://docs.expo.dev/guides/permissions/).
- [Versionado remoto EAS](https://docs.expo.dev/build-reference/app-versions/), [APKs](https://docs.expo.dev/build-reference/apk/) y [CLI](https://docs.expo.dev/eas/cli/).
- [Planes/cuotas EAS](https://docs.expo.dev/billing/plans/) y [manifest merger de Android](https://developer.android.com/build/manage-manifests).


## Para que el changelog salga bien

Los commits deben seguir [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/):

- `feat: ...` → sección **Added**
- `fix: ...` → sección **Fixed**
- `refactor:` / `perf:` / `style:` / `content:` / `design:` → sección **Changed**
- `docs:` / `chore:` / `test:` / `ci:` / `build:` / `merge:` → no aparecen en el changelog (ruido interno)

## Abrir un Pull Request

Después de pushear tu rama, GitHub muestra un botón **"Compare & pull request"** en la home del repo. Si no aparece: pestaña **Pull requests → New pull request**.
