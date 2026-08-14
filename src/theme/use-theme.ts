import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { useAppSelector } from '@/store';
import { resolveTheme, THEMES, type ThemeColors, type ThemeName } from '@/theme/theme';

/**
 * Colores del tema activo. Depende de dos cosas: la preferencia guardada
 * (Automático / Claro / Oscuro) y, si es automática, el tema del sistema
 * (`useColorScheme` se actualiza solo cuando el usuario lo cambia en Ajustes).
 */
export function useTheme(): { name: ThemeName; colors: ThemeColors } {
  const preference = useAppSelector((state) => state.settings.themePreference);
  const systemScheme = useColorScheme();

  return useMemo(() => {
    const name = resolveTheme(preference, systemScheme);
    return { name, colors: THEMES[name] };
  }, [preference, systemScheme]);
}

/** Atajo cuando solo hacen falta los colores. */
export function useThemeColors(): ThemeColors {
  return useTheme().colors;
}
