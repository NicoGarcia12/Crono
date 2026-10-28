# Crono 📅

Crono es una **agenda personal para el celular**. Sirve para no olvidarse de las fechas que importan —cumpleaños, aniversarios, días festivos, citas médicas o cualquier evento— y para tener notas rápidas a mano.

Todo queda **guardado solo en tu celular**: no hay servidor, ni cuenta, ni internet de por medio. La app se abre con la huella, la cara o el PIN del propio teléfono, y avisa con notificaciones locales antes de cada fecha.

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
- Si los recordatorios no están disponibles (por ejemplo, en Expo Go), la app lo avisa en vez de fallar en silencio.

### Cumpleaños
- **Importar cumpleaños desde los contactos** del celular: lista los contactos con teléfono de tu cuenta de Google (Android) o iCloud/Google (iOS), permite editar el nombre antes de guardar y marca los que ya están cargados.
- Botón **Saludar por WhatsApp** en cumpleaños y aniversarios.
- **Ideas de regalo** por persona.

### Perfil
- Nombre y **foto de perfil** del usuario (se pide el nombre en el primer uso).
- **Mi cumpleaños**: muestra qué edad cumplís este año y la lista **¿Quién me saludó?**, que junta las personas de tu agenda y las que anotes a mano. Arranca limpia cada año sin borrar los anteriores.
- **Modo oscuro**: automático (sigue al sistema), claro u oscuro.
- **Copia de seguridad**: exporta a un archivo los eventos (con sus avisos, etiquetas y campos), las notas, los tipos de evento y la lista de saludos, y lo restaura en otro celular. Las fotos y las ideas de regalo no viajan en el backup.
- Acceso al editor de **Tipos de evento**.

### Notas
- Pestaña **Notas** para apuntes rápidos, con crear, editar y borrar.

### Seguridad y privacidad
- La app se **bloquea** con la biometría o el PIN del teléfono. Si la dejás en segundo plano más de **2 minutos**, se vuelve a bloquear.
- Los datos viven en una base **SQLite local**; no se mandan a ningún lado.
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
| Bloqueo con biometría | ✅ | ❌ (se saltea) | ✅ |
| Recordatorios (notificaciones) | ⚠️ limitado en Android | ❌ | ✅ |
| Importar contactos | ✅ (sin filtro por cuenta en Android) | ❌ | ✅ |

El filtro de contactos por cuenta de Google usa un **módulo nativo propio** (`modules/crono-contact-accounts`, en Kotlin). Expo Go no lo incluye; si no está, la app simplemente no filtra.

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
| `npm run build:apk` | Genera un APK instalable con EAS |

La primera vez que corras los e2e instalá el navegador: `npx playwright install chromium`.

---

## Generar el APK

Para usar Crono como app propia (ícono, nombre, recordatorios completos, sin Expo Go):

```bash
npm run build:apk
```

El build corre en la nube de [EAS](https://expo.dev/accounts/nicogarcia12/projects/Crono) (cuenta gratuita; pide `npx eas-cli login` la primera vez) y al terminar da un **link con QR** para descargar el APK e instalarlo en cualquier Android. Ese mismo link se puede compartir.

Perfiles en `eas.json`:

| Perfil | Genera | Para qué |
| --- | --- | --- |
| `preview` | APK | Instalar directo en el celular y compartir |
| `development` | APK (dev client) | Desarrollar con los módulos nativos (contactos, notificaciones) |
| `production` | AAB | Publicar en Play Store (a futuro) |

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

**Migraciones**: el esquema de la base se versiona en `src/db/database.ts`. Si cambiás tablas, agregá una migración nueva en vez de editar las existentes, así los celulares que ya tienen datos se actualizan sin perderlos.

### Decisiones de diseño
- **Sin servidor**: privacidad total y funciona sin conexión. La contracara es que los datos viven en el celular; para no perderlos está la copia de seguridad.
- **Bloqueo del sistema en vez de contraseña propia**: una app no puede leer el PIN del teléfono, así que delega en la biometría/PIN del sistema operativo.
- **Tipos por funciones, no por nombre**: el código pregunta "¿este tipo tiene la función WhatsApp?" en vez de "¿es un cumpleaños?". Así un tipo propio como "Cumple de mascota" se comporta igual que uno de fábrica.

---

## Cómo contribuir

- El trabajo se hace en ramas que salen de **`develop`** y vuelven por Pull Request a `develop`. `main` solo recibe releases.
- Los commits siguen [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/) (`feat:`, `fix:`, `refactor:`, …): con eso se arma el changelog solo.
- Cada PR corre en CI (GitHub Actions): typecheck, Jest y Playwright.
- Las capturas de evidencia van como imágenes adjuntas en el PR, no se commitean.
- Cómo se versiona y se publica una release: ver [RELEASING.md](RELEASING.md). Los cambios de cada versión están en [CHANGELOG.md](CHANGELOG.md).
