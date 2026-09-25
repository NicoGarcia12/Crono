---
description: Genera un APK con EAS (perfil preview) y arma el checklist de prueba manual en dispositivo real para la rama/PR actual
---

# Probar en dispositivo

Uso: `/probar-en-dispositivo [numero-de-PR]`

Este comando se usa para probar en un celular real (vía APK) el fix o feature de la rama en la que se está parado, antes de mergear el PR.

## Pasos a seguir

1. **Identificar el PR relevante.**
   - Si se pasó un número como argumento, usá `gh pr view <numero> --json title,body,baseRefName`.
   - Si no, buscá el PR de la rama actual con `gh pr view --json title,body,baseRefName` (o `gh pr list --head <rama-actual>` si no hay uno vinculado).
   - Si no existe ningún PR abierto para esta rama, avisá y preguntá si continuar solo con el build.

2. **Armar el checklist de prueba manual** a partir de la sección "Test plan" / "Resumen" / "Cambios" del body del PR. Traducilo a pasos concretos y accionables: qué pantalla abrir, qué acción disparar, qué comportamiento se espera antes del fix vs. después. Si el PR ya trae ítems de test plan sin marcar, usalos como base.

3. **Confirmar antes de lanzar el build** — `eas build` consume minutos de build de EAS (tiene cuota/costo), así que preguntá explícitamente: "¿Corro `eas build --platform android --profile preview`?" antes de ejecutarlo. No lo dispares sin confirmación.

4. Si confirma, ejecutá parado en la rama actual:
   ```bash
   eas build --platform android --profile preview
   ```
   (usa el perfil `preview` de `eas.json`: APK standalone de distribución interna, sin necesidad de `expo-dev-client`).

5. Cuando termine el build, compartí el link/QR de descarga que da EAS.

6. Mostrá el checklist armado en el paso 2 como lista numerada, en español, listo para ir tildando durante la prueba en el celular.

7. Al final, recordá marcar el checkbox correspondiente del test plan en la descripción del PR una vez confirmado que todo funciona.
