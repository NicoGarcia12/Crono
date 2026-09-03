# Identidad visual de Crono

## Isotipo y logotipo

- `assets/images/branding/crono-isotipo.png` — la "C" en neón azul, fondo transparente, 1254×1254.
- `assets/images/branding/crono-logotipo.png` — wordmark completo "Crono", fondo transparente, 1983×793.

Ambos son PNG con canal alfa real (no fondo sólido "quemado"), así que sirven directo para splash/header sobre cualquier fondo.

## Paleta principal

| Uso | Nombre | Hex |
|---|---|---|
| Azul principal del logo | Azul Crono | `#168BFF` |
| Principal interactivo | Azul intenso | `#0878E8` |
| Hover | Azul profundo | `#0064C8` |
| Active / pressed | Azul oscuro | `#0052A6` |
| Azul luminoso | Cian neón | `#45D6FF` |
| Fondo oscuro | Azul noche | `#050816` |
| Superficie oscura | Azul pizarra | `#0C1428` |
| Borde oscuro | Azul grisáceo | `#243656` |

Color oficial de marca: **`#168BFF`**.

## Tema oscuro

| Elemento | Color |
|---|---|
| Fondo general | `#050816` |
| Cards y navbar | `#0C1428` |
| Superficie elevada | `#121E38` |
| Bordes | `#243656` |
| Texto principal | `#F5F9FF` |
| Texto secundario | `#A9B8D0` |
| Primary | `#168BFF` |
| Primary hover | `#45A8FF` |
| Glow | `#45D6FF` |

Brillo del logo en oscuro:

```css
filter:
  drop-shadow(0 0 4px rgb(22 139 255 / 70%))
  drop-shadow(0 0 12px rgb(69 214 255 / 35%));
```

## Tema claro

| Elemento | Color |
|---|---|
| Fondo general | `#F7FAFE` |
| Cards y navbar | `#FFFFFF` |
| Superficie secundaria | `#EDF4FC` |
| Bordes | `#D3E0EF` |
| Texto principal | `#101828` |
| Texto secundario | `#52647A` |
| Primary | `#168BFF` |
| Primary hover | `#0878E8` |
| Primary suave | `#E2F1FF` |

Logo en claro, sin resplandor intenso:

```css
filter: drop-shadow(0 2px 3px rgb(0 82 166 / 18%));
```

## Variables CSS

```css
:root {
  --crono-blue: #168bff;
  --crono-blue-hover: #0878e8;
  --crono-blue-active: #0064c8;
  --crono-cyan: #45d6ff;

  --background: #f7fafe;
  --surface: #ffffff;
  --surface-secondary: #edf4fc;
  --border: #d3e0ef;

  --text-primary: #101828;
  --text-secondary: #52647a;
}

[data-theme="dark"] {
  --background: #050816;
  --surface: #0c1428;
  --surface-secondary: #121e38;
  --border: #243656;

  --text-primary: #f5f9ff;
  --text-secondary: #a9b8d0;
}
```

## Regla de identidad

- Mismo azul `#168BFF` en ambos temas.
- Tema oscuro: permitir brillo cian.
- Tema claro: logo plano o con sombra mínima.
- Versión monocromática blanca únicamente para fondos donde el azul no alcance suficiente contraste.

## Opinión

La paleta funciona y es una buena decisión: `#168BFF` está muy cerca del `primary` actual (`#208AEF`), así que es una evolución del azul de la app, no un giro brusco de marca — y calza con el tono eléctrico del isotipo nuevo. La regla de "mismo azul en los dos temas, brillo solo en oscuro" es exactamente cómo se trabaja un logo neón: en claro un glow fuerte se ve sucio, en oscuro es lo que le da personalidad.

Un par de números de contraste (WCAG) para tenerlos en cuenta antes de tocar `theme.ts`:

- `#168BFF` sobre `#050816` (fondo oscuro): **5.86:1** — pasa AA para texto normal e íconos sin problema.
- `#168BFF` sobre `#F7FAFE` / `#FFFFFF` (fondo claro): **~3.3:1** — pasa para íconos/botones grandes (mínimo 3:1), pero **no** para texto chico (necesita 4.5:1). Esto ya pasa hoy con el `#208AEF` actual (3.27:1), así que no es una regresión, pero tampoco se soluciona solo por cambiar el hex.
- Si en algún punto necesitás texto azul chico en modo claro (un link, un precio), usá `#0878E8` (4.13–4.32:1, al filo de AA) o mejor `#0064C8` (5.49:1, holgado) en vez de `#168BFF` puro.
- Los bordes (`#243656` en oscuro, `#D3E0EF` en claro) tienen contraste bajo contra su fondo (1.3–1.65:1) — está bien porque son bordes sutiles decorativos, no el único indicador de un límite interactivo (inputs, focus rings). Si en algún componente el borde es la única señal de foco/click, ahí sí conviene un tono más marcado.

**Pendiente de decidir con vos**: ¿este azul reemplaza `primary`/`danger` en `src/theme/theme.ts` (afecta toda la UI: tab bar, botones, switches) o se queda solo para el logo/splash por ahora y la app sigue con el azul actual?
