---
description: Levanta el server de Expo local y da el QR para abrir la rama actual en la app Expo Go del celular
---

# Probar en dispositivo

Uso: `/probar-en-dispositivo [numero-de-PR]`

Este comando se usa para probar en un celular real el fix o feature de la rama en la que se está parado, antes de mergear el PR. Usa **Expo Go** (local, sin subir nada a ningún servidor de build) en vez de generar un APK: Crono no tiene código nativo custom (todos los paquetes son del SDK de Expo — `expo-contacts`, `expo-local-authentication`, `expo-sqlite`, `expo-notifications`, `react-native-reanimated`, etc.), así que corre sin problema dentro de Expo Go.

> Si en algún momento se agrega un módulo nativo que Expo Go no trae de fábrica, este flujo deja de servir y hay que pasar a un build con `expo-dev-client` (`eas build --profile development`).

## Pasos a seguir

1. **Armar el checklist de prueba.**
   - Si se pasó un número de PR como argumento, usá `gh pr view <numero> --json title,body`. Si no, `gh pr view --json title,body` sobre la rama actual (o `gh pr list --head <rama-actual>` si no hay uno vinculado).
   - Si no hay PR abierto, avisá y seguí igual solo con el server local.
   - Con la sección "Test plan" / "Resumen" del body, armá un checklist concreto y accionable: qué pantalla abrir, qué acción disparar, qué se espera ver.

2. **Levantar el servidor de Expo en background** (es un proceso que queda corriendo, no se puede esperar a que termine):
   ```bash
   npx expo start
   ```
   Ejecutalo con salida a un log file para poder leerlo después, por ejemplo:
   ```bash
   npx expo start > /tmp/expo-start.log 2>&1 &
   ```
   Esperá unos segundos y leé el log para sacar:
   - La URL `exp://IP:PUERTO` (sirve como fallback si el QR no se puede escanear desde la terminal).
   - El QR en ASCII que imprime Metro — mostraselo al usuario tal cual salió en la terminal.

3. **Decirle al usuario:**
   - Si no tiene la app **Expo Go** instalada, que la baje (Play Store / App Store).
   - Que escanee el QR con la cámara del celular (iOS) o desde adentro de Expo Go → "Scan QR code" (Android).
   - Si el celular no está en la misma red Wi-Fi que la PC, relanzar con `npx expo start --tunnel` (más lento para arrancar, pero funciona por internet).
   - Como alternativa al QR, puede tocar "Enter URL manually" en Expo Go y pegar la URL `exp://...` del paso 2.

4. Mostrá el checklist armado en el paso 1, en español, como lista numerada, para ir tildando durante la prueba.

5. Al terminar la prueba, recordá:
   - Matar el proceso de `expo start` que quedó en background.
   - Marcar el checkbox correspondiente del test plan en la descripción del PR si todo funcionó bien.
