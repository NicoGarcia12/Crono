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
   - Bumpea la versión en `package.json`.
   - Abre el PR `release/X.Y.Z → main`.
3. Revisá el PR (podés editar el `CHANGELOG.md` a mano si algo quedó raro) y mergealo cuando quieras.

## Qué pasa al mergear el release

Automático, sin que hagas nada más:

- Se crea el tag `vX.Y.Z`.
- Se publica el **Release** en GitHub con la sección nueva del changelog como notas.
- `main` se mergea de vuelta a `develop`, para que no se desincronicen.

## Para que el changelog salga bien

Los commits deben seguir [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/):

- `feat: ...` → sección **Added**
- `fix: ...` → sección **Fixed**
- `refactor:` / `perf:` / `style:` → sección **Changed**
- `docs:` / `chore:` / `test:` / `ci:` / `build:` → no aparecen en el changelog (ruido interno)

## Abrir un Pull Request

Después de pushear tu rama, GitHub muestra un botón **"Compare & pull request"** en la home del repo. Si no aparece: pestaña **Pull requests → New pull request**.
