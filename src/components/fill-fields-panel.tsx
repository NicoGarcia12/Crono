import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CustomFieldsSection, fieldValuesProblem, type EventFieldSpec } from '@/components/custom-fields-section';
import { useAppDispatch, useAppSelector } from '@/store';
import { saveFieldValues } from '@/store/field-values-slice';
import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';
import type { FieldValues } from '@/types';
import { formatLongDate } from '@/utils/dates';

interface FillFieldsPanelProps {
  /** Eventos a recorrer, en orden. */
  eventIds: number[];
  /** Campos recién agregados que se ofrecen para cargar. */
  fieldIds: number[];
  onDone: () => void;
}

/**
 * Después de agregar un dato nuevo a un tipo (o a una base) con eventos ya
 * cargados: recorre esos eventos de a uno para completarlo. Cada uno se puede
 * guardar o saltear, y se puede terminar en cualquier momento.
 */
export function FillFieldsPanel({ eventIds, fieldIds, onDone }: FillFieldsPanelProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const dispatch = useAppDispatch();

  const events = useAppSelector((state) => state.events.items);
  const fields = useAppSelector((state) => state.eventBases.fields);
  const saved = useAppSelector((state) => state.fieldValues.byEvent);

  // Acá todo es opcional: se puede dejar vacío y completarlo después desde el evento.
  const specs: EventFieldSpec[] = useMemo(
    () => fields.filter((f) => fieldIds.includes(f.id)).map((f) => ({ ...f, required: false })),
    [fields, fieldIds],
  );

  const [index, setIndex] = useState(0);
  const [values, setValues] = useState<FieldValues>({});
  const [busy, setBusy] = useState(false);

  const event = events.find((e) => e.id === eventIds[index]);
  const problem = fieldValuesProblem(specs, values);

  const next = () => {
    setValues({});
    if (index + 1 >= eventIds.length) onDone();
    else setIndex(index + 1);
  };

  const saveAndNext = async () => {
    if (!event || problem) return;
    setBusy(true);
    try {
      // Se suman a los valores que el evento ya tenía en otros campos.
      await dispatch(saveFieldValues({ eventId: event.id, values: { ...saved[event.id], ...values } })).unwrap();
      next();
    } finally {
      setBusy(false);
    }
  };

  if (!event) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>
        Evento {index + 1} de {eventIds.length}
      </Text>
      <Text style={styles.title}>{event.title}</Text>
      <Text style={styles.date}>{formatLongDate(event.date)}</Text>

      <CustomFieldsSection specs={specs} values={values} onChange={setValues} />
      {problem ? <Text style={styles.problem}>{problem}</Text> : null}

      <View style={styles.actions}>
        <Pressable style={styles.secondary} onPress={next}>
          <Text style={styles.secondaryText}>Saltear</Text>
        </Pressable>
        <Pressable style={[styles.primary, (busy || problem !== null) && styles.disabled]} disabled={busy || problem !== null} onPress={() => void saveAndNext()}>
          <Text style={styles.primaryText}>{index + 1 >= eventIds.length ? 'Guardar' : 'Guardar y seguir'}</Text>
        </Pressable>
      </View>
      <Pressable style={styles.finish} onPress={onDone}>
        <Text style={styles.finishText}>Terminar</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { gap: 6, backgroundColor: c.surfaceAlt, borderRadius: 14, padding: 14 },
    progress: { fontSize: 12, fontWeight: '600', color: c.textSubtle, textTransform: 'uppercase' },
    title: { fontSize: 17, fontWeight: '700', color: c.text },
    date: { fontSize: 13, color: c.textMuted },
    problem: { fontSize: 13, color: c.danger },
    actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
    secondary: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 20, borderWidth: 1, borderColor: c.border },
    secondaryText: { color: c.textMuted, fontWeight: '600' },
    primary: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 20, backgroundColor: c.primary },
    primaryText: { color: '#fff', fontWeight: '700' },
    disabled: { opacity: 0.4 },
    finish: { alignItems: 'center', paddingVertical: 8 },
    finishText: { color: c.textMuted, fontWeight: '600' },
  });
