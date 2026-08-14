/**
 * Paleta y tema de la app.
 *
 * 💡 Aprendizaje: en React Native no hay variables CSS ni `prefers-color-scheme`.
 * El patrón es tener un objeto de colores por tema y leerlo desde un contexto,
 * y construir los StyleSheet en función de esos colores (por eso los estilos
 * pasan de ser una constante suelta a una función `makeStyles(colors)`).
 */

export const THEME_PREFERENCES = ['sistema', 'claro', 'oscuro'] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export type ThemeName = 'claro' | 'oscuro';

export interface ThemeColors {
  /** Fondo de las pantallas. */
  background: string;
  /** Tarjetas, inputs, barras. */
  surface: string;
  /** Fondo de un elemento apoyado sobre `surface` (chips, celdas). */
  surfaceAlt: string;
  border: string;
  text: string;
  /** Texto secundario (subtítulos, descripciones). */
  textMuted: string;
  /** Texto terciario (placeholders, ayudas). */
  textSubtle: string;
  /** Color de marca: acciones principales. */
  primary: string;
  danger: string;
  success: string;
  whatsapp: string;
  /** Fondo de un chip activo oscuro (filtros de vista). */
  contrast: string;
  contrastText: string;
  /** Sombra de las tarjetas (en oscuro casi no se ve). */
  shadow: string;
}

const light: ThemeColors = {
  background: '#f5f6fa',
  surface: '#ffffff',
  surfaceAlt: '#ffffff',
  border: '#e2e2e2',
  text: '#1a1a2e',
  textMuted: '#777777',
  textSubtle: '#999999',
  primary: '#208AEF',
  danger: '#E91E63',
  success: '#4CAF50',
  whatsapp: '#25D366',
  contrast: '#1a1a2e',
  contrastText: '#ffffff',
  shadow: '#000000',
};

const dark: ThemeColors = {
  background: '#111218',
  surface: '#1c1e27',
  surfaceAlt: '#262a36',
  border: '#333747',
  text: '#f1f2f6',
  textMuted: '#a3a7b3',
  textSubtle: '#7d8290',
  // Un azul apenas más claro: sobre fondo oscuro el original queda oscuro/apagado.
  primary: '#4AA3F5',
  danger: '#F0568B',
  success: '#5DC264',
  whatsapp: '#25D366',
  // En oscuro el "chip activo" no puede ser casi negro (se perdería contra el
  // fondo): se usa un gris elevado, que igual lleva texto blanco encima.
  contrast: '#3d4356',
  contrastText: '#ffffff',
  shadow: '#000000',
};

export const THEMES: Record<ThemeName, ThemeColors> = { claro: light, oscuro: dark };

/** Qué tema aplicar según la preferencia elegida y el tema del sistema. */
export function resolveTheme(
  preference: ThemePreference,
  systemScheme: 'light' | 'dark' | null | undefined,
): ThemeName {
  if (preference === 'claro') return 'claro';
  if (preference === 'oscuro') return 'oscuro';
  return systemScheme === 'dark' ? 'oscuro' : 'claro';
}

/** Etiquetas del selector en Perfil. */
export const THEME_LABELS: Record<ThemePreference, string> = {
  sistema: 'Automático',
  claro: 'Claro',
  oscuro: 'Oscuro',
};
