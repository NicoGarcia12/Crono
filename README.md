# Crono 📅

Crono es una **agenda personal para el celular**. Sirve para no olvidarse de las fechas que importan —cumpleaños, aniversarios, días festivos, citas médicas o cualquier evento— y para tener notas rápidas a mano.

Los datos quedan **en el celular o navegador que usás**, sin servidor ni sincronización automática. En Android/iOS, Crono delega el bloqueo en la credencial del sistema y programa avisos locales si le das permiso.

Funciona en **Android**, **iOS** y también en el **navegador** (con algunas limitaciones, ver más abajo).

---

## Qué hace la app

### Agenda
- Pestaña **Agenda** con todos los eventos próximos ordenados por fecha; los que ya pasaron se ocultan solos.
- Cada evento tiene título, fecha, hora opcional, descripción, tipo, etiquetas y foto.
- Los eventos anuales (cumpleaños, aniversarios, festivos) se repiten cada año automáticamente.
- En el detalle de cada evento se ve una **cuenta regresiva** ("faltan 12 días").
- **Buscador** que filtra eventos y notas por texto.
- **Etiquetas** propias para clasificar eventos y filtrar la agenda.

### Calendario
- Pestaña **Calendario** con vista **mensual** y **semanal**, navegable hacia atrás y adelante.
- Marca los días con eventos y muestra los cumpleaños y aniversarios del mes.

### Tipos de evento
- Vienen 5 tipos de fábrica: **Evento**, **Cumpleaños**, **Aniversario**, **Día festivo** y **Cita médica**.
- Se pueden **crear tipos propios** y editar nombre, ícono y color de cualquiera (incluso los de fábrica).
- Cada tipo parte de una **base** que define cómo se comporta (si se repite cada año, si la hora es obligatoria) y se le pueden sumar **funciones**:
  - **Edad**: muestra cuántos años cumple la persona.
  - **Años transcurridos**: cuántos años pasaron desde la fecha.
  - **¿Ya lo saludé?**: un check por año para marcar el saludo.
  - **Saludo por WhatsApp**: teléfono y botón para abrir el chat directo.
  - **Ideas de regalo**: lista de ideas para esa persona.
- También se pueden agregar **campos extra** (texto, número, una opción o varias opciones) y marcarlos como obligatorios, hasta un máximo de 15 cosas por tipo.
- Al borrar un tipo, sus eventos se mueven al tipo que elijas; nada se pierde.

### Recordatorios
- Cada evento puede tener **varios avisos**: en el momento, 1 hora antes, 1 día antes, 1 semana antes, o uno **a medida** (número + unidad).
- Las notificaciones son humanas: llevan el emoji del tipo en el título ("🎂 Cumple de Ana") y dicen el tiempo relativo ("Es mañana", "Es en 3 días").
- Si los recordatorios no están disponibles (web o Expo Go para Android, por una restricción de Crono), la app lo avisa en vez de prometer notificaciones.
- Al iniciar, la app actualiza los avisos anuales guardados con el contrato anterior; los eventos ya actualizados no se vuelven a programar.
- Si el sistema no puede cancelar avisos, aparece **Reintentar limpieza**. Si tampoco se pudo guardar esa limpieza pendiente, no cierres la app antes de reintentar.

### Cumpleaños
- **Importar cumpleaños desde los contactos** del celular: lista los contactos con teléfono de tu cuenta de Google (Android) o iCloud/Google (iOS), permite editar el nombre antes de guardar y marca los que ya están cargados.
- Botón **Saludar por WhatsApp** en cumpleaños y aniversarios.
- **Ideas de regalo** por persona.

### Perfil
- Nombre y **foto de perfil** del usuario (se pide el nombre en el primer uso).
- **Mi cumpleaños**: muestra qué edad cumplís este año y la lista **¿Quién me saludó?**, que junta las personas de tu agenda y las que anotes a mano. Arranca limpia cada año sin borrar los anteriores.
- **Modo oscuro**: automático (sigue al sistema), claro u oscuro.
- **Copia de seguridad**: exporta desde SQLite el nombre de perfil, los eventos (con sus avisos, etiquetas y campos), las notas, los tipos propios y las personalizaciones de los tipos de fábrica, los saludos de todos los años y las marcas **¿Ya lo saludé?**. Al restaurar agrega lo que falta sin pisar los datos locales coincidentes. Las fotos y las ideas de regalo no viajan en el backup.
- Acceso al editor de **Tipos de evento**.

### Notas
- Pestaña **Notas** para apuntes rápidos, con crear, editar y borrar.

### Seguridad y privacidad
- En Android/iOS, la app se **bloquea** con la credencial del teléfono. Si la dejás en segundo plano más de **2 minutos**, se vuelve a bloquear. En web muestra una advertencia y pide continuar explícitamente, pero no hay bloqueo local.
- Los datos viven en una base **SQLite local**, del dispositivo o navegador actual; no se mandan a ningún servidor.
- Los permisos (contactos, fotos, cámara) se piden solo cuando usás la función que los necesita.

---

## Levantarla en local

### Requisitos
- **Node.js 22** (es la versión que usa CI) y npm.
- **Git**.
- Para probar en el celular: la app **Expo Go** (Play Store / App Store) compatible con **Expo SDK 57**.
- Opcional: Android Studio (emulador Android) o Xcode (simulador iOS, solo macOS).

### Primeros pasos

```bash
git clone https://github.com/NicoGarcia12/Crono.git
cd Crono
npm install
npm start
```

> El repo tiene un `.npmrc` con `legacy-peer-deps=true`, así que `npm install` resuelve las dependencias sin pasos extra.

`npm start` levanta el servidor de desarrollo de Expo y muestra un QR:

- **Celular**: escaneá el QR con Expo Go (Android) o con la cámara (iOS). El celu y la compu tienen que estar en la misma red; si no, usá `npx expo start --tunnel`.
- **Web**: apretá `w` en la terminal o corré `npm run web`.
- **Emulador**: apretá `a` (Android) o `i` (iOS), o corré `npm run android` / `npm run ios`.

Cualquier cambio que guardes en `src/` se recarga solo en el celular o el navegador (Fast Refresh).

### Qué funciona en cada entorno

| Función | Expo Go | Web | APK / development build |
| --- | --- | --- | --- |
| Agenda, calendario, notas, tipos, backup | ✅ | ✅ | ✅ |
| Bloqueo con credencial del sistema | Según la credencial disponible; Face ID iOS requiere development build | Advertencia + continuar sin bloqueo | Credencial del sistema |
| Recordatorios (notificaciones) | Desactivados en Crono Android; disponibles en iOS con permiso | No disponibles | Con permiso del sistema |
| Importar contactos | ✅ (sin filtro por cuenta en Android) | ❌ | ✅ |

El filtro de contactos por cuenta de Google usa un **módulo nativo propio** (`modules/crono-contact-accounts`, en Kotlin). Expo Go no lo incluye; si no está, la app simplemente no filtra.

SDK 57 admite notificaciones **locales** en Expo Go; lo retirado en Android es el push remoto. Crono mantiene su propio guard para Expo Go Android. En web, las anticipaciones se guardan como referencia: para programar avisos, usá la app instalada y creá, editá o restaurá allí los eventos. La importación de contactos requiere la app instalada incluso si abrís el navegador desde un celular. El backup web se descarga y se restaura eligiendo un archivo del equipo; no sincroniza automáticamente con otros dispositivos.

### Scripts

| Comando | Qué hace |
| --- | --- |
| `npm start` | Levanta el servidor de desarrollo de Expo |
| `npm run android` / `npm run ios` | Abre la app en el emulador o simulador |
| `npm run web` | Abre la app en el navegador |
| `npm run lint` | ESLint con la config de Expo |
| `npx tsc --noEmit` | Chequeo de tipos (TypeScript estricto) |
| `npm test` | Tests unitarios con Jest |
| `npm run test:watch` | Jest en modo watch |
| `npm run e2e` | Tests end-to-end con Playwright sobre la versión web (levanta el servidor solo) |
| `node --test scripts/test-migrations.cjs` | #36: migraciones de producción sobre SQLite real, fallos entre sentencias y recuperación tras interrupciones |
| `node --test scripts/test-event-save.cjs` | #37: guardado atómico, rollback, reintento, concurrencia y coherencia con Redux sobre SQLite real |
| `node --test scripts/test-reminders.cjs` | #39: avisos anuales, reconciliación, compensación y reintento de cancelaciones con SQLite real y el validador de Expo |
| `node --test scripts/test-backup.cjs` | #41: snapshot SQLite, roundtrip, restauración atómica, reimportación, vínculos y concurrencia de escrituras |
| `npm run build:apk` | Genera una preview APK con EAS e incrementa el número de build remoto (consume cuota; requiere autorización) |
| `npm run release:version -- X.Y.Z` | Sincroniza package, lock y la versión visible Expo; lo usa el corte automatizado, no genera tags ni builds |

La primera vez que corras los e2e instalá el navegador: `npx playwright install chromium`.

Los harnesses #36, #37, #39 y #41 requieren Node.js 22.13+ de la rama 22 LTS (N-1) por `node:sqlite`. Sustituyen el puente Expo y, en #37, #39 y #41, el scheduler nativo: no validan el upgrade de un APK instalado, la instalación limpia nativa ni la entrega de avisos del sistema operativo. En #41 también se sustituyen el selector y la salida de archivos; el modo Android modela las claves foráneas desactivadas de la transacción exclusiva, pero no abre la conexión nativa separada real de Expo.

---

## Generar el APK

Para usar Crono como app propia (ícono, nombre, recordatorios completos, sin Expo Go):

```bash
npm run build:apk
```

El build corre en la nube de [EAS](https://expo.dev/accounts/nicogarcia12/projects/Crono) y al terminar da un **link con QR** para descargar el APK. Requiere acceso al proyecto y una cuota disponible; iniciá sesión con `npx eas-cli login` si hace falta. Confirmá el entorno de pruebas, consumo de builds, quality gate y rollback antes de ejecutarlo. Los límites dependen del [plan vigente](https://docs.expo.dev/billing/plans/), no se asumen builds ilimitados ni enlaces permanentes.

Perfiles en `eas.json`:

| Perfil | Genera | Para qué |
| --- | --- | --- |
| `preview` | APK; `versionCode` remoto creciente | Instalar directo y probar actualizaciones sin desinstalar |
| `development` | APK (dev client) | Desarrollar con los módulos nativos (contactos, notificaciones) |
| `production` | AAB | Publicar en Play Store (a futuro) |

El corte de release mantiene `package.json.version` y `app.json.expo.version` iguales. `preview` y `production` incrementan los números de build en EAS; no hay contador local en Git. Para identificar cada APK por SHA, versión, perfil, ID y `versionCode`, verificar firma/permisos y probar dos previews conservando datos, seguí [RELEASING.md](RELEASING.md). Cámara y galería conservan sus permisos; Crono no pide micrófono en sus nuevos binarios (Expo Go usa su propio manifest).

---

## Cómo está armado

### Stack

| Capa | Tecnología |
| --- | --- |
| Framework | React Native 0.86 + Expo SDK 57 (managed) |
| Navegación | Expo Router (rutas basadas en archivos) |
| Base de datos | expo-sqlite (en web, SQLite compilado a WebAssembly) |
| Estado global | Redux Toolkit |
| Bloqueo | expo-local-authentication |
| Recordatorios | expo-notifications (locales, sin internet) |
| Lenguaje | TypeScript estricto, con React Compiler activado |
| Tests | Jest + React Native Testing Library, Playwright |

### Estructura

```
src/
├── app/                    # Pantallas (Expo Router): cada archivo es una ruta
│   ├── _layout.tsx         #   Providers, init de la BD, bloqueo y primer uso
│   ├── (tabs)/             #   Pestañas: Agenda, Calendario, Notas, Perfil
│   ├── evento/             #   Crear y editar eventos
│   ├── nota/               #   Crear y editar notas
│   ├── regalos/            #   Ideas de regalo de una persona
│   ├── cargar-cumpleanos   #   Importar cumpleaños de contactos
│   ├── saludos             #   ¿Quién me saludó?
│   └── tipos-evento        #   Editor de tipos, bases y campos
├── components/             # Componentes de UI (formularios, tarjetas, diálogos, lock screen)
├── constants/              # Tipos y bases de fábrica, funciones, presets de recordatorio
├── db/                     # SQLite: conexión, migraciones y repositorios (única capa con SQL)
├── store/                  # Redux Toolkit: un slice por entidad + hooks tipados
├── notifications/          # Programar y cancelar recordatorios
├── backup/                 # Exportar e importar la copia de seguridad (versión nativa y web)
├── contacts/               # Lectura y filtro de contactos para importar cumpleaños
├── greetings/              # Lógica de "¿Quién me saludó?"
├── media/                  # Fotos de perfil y de eventos
├── theme/                  # Paleta clara/oscura y hook de tema
└── utils/                  # Fechas, calendario, búsqueda, WhatsApp, recordatorios
modules/crono-contact-accounts/  # Módulo nativo Android para filtrar contactos por cuenta
e2e/                        # Tests end-to-end (Playwright)
docs/identidad-visual.md    # Logo, isotipo y paleta de colores
```

**Flujo de datos**: pantalla → `dispatch(thunk)` → repositorio SQLite (+ notificación) → Redux se actualiza → la pantalla se vuelve a dibujar. SQLite es la fuente de verdad y Redux es la copia en memoria, por eso no hace falta `redux-persist`.

**Migraciones (#36)**: el esquema de la base se versiona en `src/db/database.ts`. Cada paso confirma sus cambios y `PRAGMA user_version` en la misma transacción; un fallo revierte ese paso y permite reintentarlo. Las migraciones legacy inspeccionan las columnas para retomar cambios ya confirmados por builds interrumpidos, sin resetear la base. La limpieza de datos no admitidos de v13 sigue siendo intencional. La conexión se publica solo al completar las migraciones. Para futuros cambios de tablas, agregá una migración nueva en vez de editar las existentes.

**Guardado de eventos (#37)**: crear o editar guarda evento, recordatorios persistidos, etiquetas, campos personalizados y cambio de `isMine` como una sola unidad SQLite. Al editar, omitir `fieldValues` conserva los valores existentes; enviar `{}` los vacía; enviar valores reemplaza el conjunto, descartando vacíos pero conservando el contenido válido. Redux se actualiza tras el commit y mantiene una sola marca de cumpleaños propio. El borrado también comparte la cola de escrituras, necesaria en web para no mezclarse con un guardado que luego se revierta. La transacción no incluye al scheduler del sistema operativo; su reconciliación y compensación se resuelven en #39, con los límites indicados abajo.

**Recordatorios (#39)**: el contrato 2 usa `YEARLY.month` de 0 a 11. La reconciliación lee SQLite al inicio, no admite ejecuciones simultáneas y guarda los IDs nuevos y la marca de contrato por evento antes de cancelar los anteriores. Si falla SQLite, conserva los anteriores y compensa los nuevos; al reintentar omite los eventos ya actualizados. Las cancelaciones rechazadas quedan en `settings.pendingReminderCancellations`; **Reintentar limpieza** confirma esos IDs en SQLite antes de volver a cancelar, sin programar otro juego. La limpieza pendiente se reintenta también al iniciar y debe completarse antes de programar nuevos avisos. Si falla su persistencia, los IDs se retienen en memoria y la app advierte que no la cierres.

Las escrituras de `settings`, incluida la limpieza pendiente, usan una transacción sobre la conexión principal y comparten la cola de escrituras de eventos para no mezclarse con una operación que pueda revertirse.

SQLite y el SO no comparten rollback: #39 no incorpora un journal ante cierre abrupto entre programar y persistir, ni barre avisos huérfanos históricos (#30). El trigger anual nativo fija un mes y día; no se garantiza la alternancia 28/2–29/2. El harness valida SQLite y el validador JavaScript de Expo con un scheduler sustituido, no entrega real, permisos ni reinicio del SO; eso requiere una candidata Android.

**Backup (#41)**: exportar toma un snapshot consistente directamente de SQLite, incluso si abrís Perfil sin haber visitado las otras pantallas. El formato 2 conserva los vínculos de los saludos y las marcas anuales con sus eventos mediante referencias del archivo; declara `excludes: ["photos", "giftIdeas"]`. El lector sigue aceptando formato 1, sin atribuirle vínculos ni marcas que ese formato no incluía.

La restauración confirma todos sus datos en una única transacción SQLite y recarga Redux después del commit. La unidad de trabajo es dueña de la transacción; sus helpers usan el mismo ejecutor, sin abrir un `BEGIN` anidado. Comparte la cola de escrituras con eventos, catálogos, notas, perfil, saludos e ideas de regalo, tanto para la conexión principal como para la exclusiva. Un fallo revierte SQLite; los avisos nuevos se compensan por separado, con la recuperación de limpieza pendiente de #39, no con un rollback del SO. El resultado informa agregados, omitidos, descartes y vínculos o campos no recuperados.

Reimportar el mismo archivo es idempotente mientras se mantengan las claves de identidad: título/tipo/fecha para eventos, título/contenido para notas y año/nombre/teléfono para saludos; las marcas enlazadas se reconocen por evento/año. Se conservan los datos locales coincidentes, las personalizaciones locales de tipos, el nombre ya cargado y la marca de cumpleaños propio. Si cambiás una clave de identidad, otra importación puede agregar el original: no hay identidad global por UUID. Los vínculos v2 se resuelven también contra eventos ya existentes; si falta el evento, el saludo queda como invitado y la marca sin vínculo se omite. Las fotos y las ideas de regalo locales no se modifican.

### Decisiones de diseño
- **Sin servidor**: funciona sin conexión; los datos viven en el dispositivo o navegador actual. Para no perderlos, exportá una copia antes de borrar la app o los datos del sitio.
- **Bloqueo del sistema en vez de contraseña propia**: una app no puede leer el PIN del teléfono, así que delega en la biometría/PIN del sistema operativo.
- **Tipos por funciones, no por nombre**: el código pregunta "¿este tipo tiene la función WhatsApp?" en vez de "¿es un cumpleaños?". Así un tipo propio como "Cumple de mascota" se comporta igual que uno de fábrica.

---

## Cómo contribuir

- El trabajo se hace en ramas que salen de **`develop`** y vuelven por Pull Request a `develop`. `main` solo recibe releases.
- Los commits siguen [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/) (`feat:`, `fix:`, `refactor:`, …): con eso se arma el changelog solo.
- Cada PR corre en CI (GitHub Actions): typecheck, Jest y Playwright.
- Las capturas de evidencia van como imágenes adjuntas en el PR, no se commitean.
- Cómo se versiona y se publica una release: ver [RELEASING.md](RELEASING.md). Los cambios de cada versión están en [CHANGELOG.md](CHANGELOG.md).
