import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import { errorMessage } from '@/components/confirm';
import type { NewNote, Note } from '@/types';
import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';

/** Formulario de nota, compartido entre crear y editar. */
interface NoteFormProps {
  initial?: Note;
  submitLabel: string;
  disabled?: boolean;
  onSubmit: (data: NewNote) => Promise<void>;
}

export function NoteForm({ initial, submitLabel, disabled = false, onSubmit }: NoteFormProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitting = useRef(false);

  const canSave = title.trim().length > 0;
  const blocked = disabled || saving;

  const handleSubmit = async (): Promise<void> => {
    if (!canSave || disabled || submitting.current) return;
    // La ref bloquea en JS antes del próximo render; disabled refleja eso en la UI.
    submitting.current = true;
    setSaving(true);
    setSubmitError(null);
    try {
      await onSubmit({ title: title.trim(), content: content.trim() });
      // El caller navega al confirmar: mantenemos la traba hasta desmontar.
    } catch (error: unknown) {
      setSubmitError(`No se pudo guardar: ${errorMessage(error)}. Tu texto sigue acá; volvé a tocar «${submitLabel}» para reintentar.`);
      submitting.current = false;
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <TextInput
        style={styles.titleInput}
        placeholder="Título"
        placeholderTextColor={colors.textSubtle}
        value={title}
        onChangeText={setTitle}
        autoFocus={!initial}
        editable={!blocked}
      />
      <TextInput
        style={styles.contentInput}
        placeholder="Escribí tu nota…"
        placeholderTextColor={colors.textSubtle}
        value={content}
        onChangeText={setContent}
        editable={!blocked}
        multiline
        textAlignVertical="top"
      />
      {submitError ? <Text style={styles.problem} accessibilityRole="alert">{submitError}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={submitLabel}
        accessibilityState={{ disabled: !canSave || blocked, busy: saving }}
        style={[styles.submit, (!canSave || blocked) && styles.submitDisabled]}
        disabled={!canSave || blocked}
        onPress={() => void handleSubmit()}
      >
        <Text style={styles.submitText}>{saving ? 'Guardando…' : submitLabel}</Text>
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  titleInput: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    padding: 13,
    fontSize: 17,
    fontWeight: '600',
    color: c.text,
  },
  contentInput: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    padding: 13,
    fontSize: 15,
    color: c.text,
    minHeight: 220,
    lineHeight: 21,
  },
  problem: { color: c.danger, fontSize: 14, lineHeight: 20 },
  submit: { backgroundColor: c.primary, borderRadius: 24, padding: 15, alignItems: 'center' },
  submitDisabled: { opacity: 0.4 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
