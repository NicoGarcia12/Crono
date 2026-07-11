import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { dateToIso, dateToTime, formatLongDate, toLocalDate, todayIso } from '@/utils/dates';

/**
 * Campos de fecha y hora multiplataforma.
 *
 * 💡 Aprendizaje: este archivo tiene un "hermano" `date-time-field.web.tsx`.
 * Metro (el bundler) elige automáticamente el archivo `.web.tsx` cuando compila
 * para navegador y este cuando compila para Android/iOS. Es la forma idiomática
 * de tener implementaciones distintas por plataforma sin ifs por todos lados —
 * hizo falta porque el DateTimePicker nativo no existe en web.
 */

export interface DateFieldProps {
  /** Fecha en formato 'YYYY-MM-DD'. */
  value: string;
  onChange: (isoDate: string) => void;
  style?: StyleProp<ViewStyle>;
}

export function DateField({ value, onChange, style }: DateFieldProps) {
  // En Android el picker es un diálogo que se abre y se cierra; este flag lo controla.
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable accessibilityLabel="Fecha" style={[styles.input, style]} onPress={() => setOpen(true)}>
        <Text style={styles.inputText}>{formatLongDate(value)}</Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={toLocalDate(value)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_event, selected) => {
            setOpen(false); // en Android el diálogo se cierra solo; esto lo refleja en el estado
            if (selected) onChange(dateToIso(selected));
          }}
        />
      ) : null}
    </>
  );
}

export interface TimeFieldProps {
  /** Hora en formato 'HH:mm', o null para "todo el día". */
  value: string | null;
  onChange: (time: string | null) => void;
  style?: StyleProp<ViewStyle>;
}

export function TimeField({ value, onChange, style }: TimeFieldProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable accessibilityLabel="Hora" style={[styles.input, style]} onPress={() => setOpen(true)}>
        <Text style={styles.inputText}>{value ?? 'Todo el día'}</Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={toLocalDate(todayIso(), value)}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_event, selected) => {
            setOpen(false);
            if (selected) onChange(dateToTime(selected));
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e2e2',
    borderRadius: 12,
    padding: 13,
  },
  inputText: { fontSize: 16, color: '#1a1a2e' },
});
