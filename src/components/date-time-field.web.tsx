import type { CSSProperties } from 'react';

import { useTheme } from '@/theme/use-theme';

import type { DateFieldProps, TimeFieldProps } from './date-time-field';

/**
 * Versión WEB de los campos de fecha y hora (Metro la elige sola en el navegador).
 *
 * 💡 Aprendizaje: cuando la app corre en web con react-native-web, el árbol lo
 * renderiza react-dom, así que acá podemos usar elementos HTML de verdad.
 * `<input type="date">` y `<input type="time">` ya traen su propio picker
 * nativo del navegador — no hace falta ninguna librería.
 */
function useInputStyle(): CSSProperties {
  const { name, colors } = useTheme();

  return {
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 12,
    padding: 13,
    fontSize: 16,
    color: colors.text,
    fontFamily: 'inherit',
    flexGrow: 1,
    // Con esto el navegador dibuja su propio ícono del picker en claro u oscuro.
    colorScheme: name === 'oscuro' ? 'dark' : 'light',
  };
}

export function DateField({ value, onChange }: DateFieldProps) {
  const style = useInputStyle();

  return (
    <input
      aria-label="Fecha"
      type="date"
      value={value}
      onChange={(event) => event.target.value && onChange(event.target.value)}
      style={style}
    />
  );
}

export function TimeField({ value, onChange }: TimeFieldProps) {
  const style = useInputStyle();

  return (
    <input
      aria-label="Hora"
      type="time"
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value || null)}
      style={style}
    />
  );
}
