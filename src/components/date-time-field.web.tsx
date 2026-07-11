import type { DateFieldProps, TimeFieldProps } from './date-time-field';

/**
 * Versión WEB de los campos de fecha y hora (Metro la elige sola en el navegador).
 *
 * 💡 Aprendizaje: cuando la app corre en web con react-native-web, el árbol lo
 * renderiza react-dom, así que acá podemos usar elementos HTML de verdad.
 * `<input type="date">` y `<input type="time">` ya traen su propio picker
 * nativo del navegador — no hace falta ninguna librería.
 */

const inputStyle = {
  backgroundColor: '#fff',
  border: '1px solid #e2e2e2',
  borderRadius: 12,
  padding: 13,
  fontSize: 16,
  color: '#1a1a2e',
  fontFamily: 'inherit',
  flexGrow: 1,
} as const;

export function DateField({ value, onChange }: DateFieldProps) {
  return (
    <input
      aria-label="Fecha"
      type="date"
      value={value}
      onChange={(event) => event.target.value && onChange(event.target.value)}
      style={inputStyle}
    />
  );
}

export function TimeField({ value, onChange }: TimeFieldProps) {
  return (
    <input
      aria-label="Hora"
      type="time"
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value || null)}
      style={inputStyle}
    />
  );
}
