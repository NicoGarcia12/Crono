# Crono 📅

Agenda personal para el celular: eventos, cumpleaños, aniversarios, días festivos, citas médicas y notas. **Todos los datos viven solo en tu celular** (SQLite local, sin servidor) y la app se desbloquea con la huella/cara/PIN del propio dispositivo.

## Stack

| Capa | Tecnología |
| --- | --- |
| Framework mobile | React Native + Expo (managed) |
| Navegación | Expo Router (rutas basadas en archivos, como Next.js) |
| Base de datos | expo-sqlite (archivo `.db` en el sandbox de la app) |
| Estado global | Redux Toolkit (mismo patrón que en React web) |
| Autenticación | expo-local-authentication (delega en el bloqueo del sistema) |
| Recordatorios | expo-notifications (notificaciones locales, sin internet) |
| Lenguaje | TypeScript estricto |

## Cómo probarla en tu celular

1. Instalá la app **Expo Go** desde Play Store / App Store.
2. En esta carpeta corré:

   ```bash
   npm install
   npx expo start
   ```

3. Escaneá el QR que aparece en la terminal con Expo Go (Android) o con la cámara (iOS).

> ⚠️ Nota: en Expo Go las notificaciones locales de Android pueden tener limitaciones. Para la experiencia completa se genera un *development build* con `npx eas build` (no hace falta para desarrollar el resto).

## Arquitectura

```
src/
├── app/                # Rutas (Expo Router): cada archivo = una pantalla
│   ├── _layout.tsx     #   Providers + init BD + bloqueo + primer uso
│   ├── (tabs)/         #   Pestañas: Agenda, Notas, Perfil
│   ├── evento/         #   Crear/editar eventos
│   └── nota/           #   Crear/editar notas
├── components/         # Componentes presentacionales (formularios, tarjetas, lock screen)
├── constants/          # Metadatos de tipos de evento, opciones de recordatorio
├── db/                 # SQLite: conexión, migraciones y repositorios (única capa con SQL)
├── notifications/      # Programar/cancelar recordatorios locales
├── store/              # Redux Toolkit: slices + hooks tipados
└── utils/              # Fechas (próxima ocurrencia, formato en español)
```

**Flujo de datos**: Pantalla → `dispatch(thunk)` → repositorio SQLite + notificación → Redux actualiza → la pantalla re-renderiza. SQLite es la fuente de verdad; Redux es solo la copia en memoria (por eso no hace falta redux-persist).

## Decisiones de diseño

- **Sin servidor**: privacidad total, funciona sin conexión. La contracara: si se pierde el celular se pierden los datos (un backup/export es candidato a próxima feature).
- **Bloqueo del sistema en vez de contraseña propia**: una app no puede leer el PIN del celular; lo correcto es delegar en `LocalAuthentication` (huella/cara/PIN del SO). La app se re-bloquea al pasar a segundo plano.
- **Eventos anuales**: cumpleaños, aniversarios y festivos se repiten cada año automáticamente (trigger `YEARLY` de notificaciones + cálculo de "próxima ocurrencia" en la agenda).
