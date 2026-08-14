import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import type { NewNote, Note } from '@/types';
import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';

/** Formulario de nota, compartido entre crear y editar. */
interface NoteFormProps {
  initial?: Note;
  submitLabel: string;
  onSubmit: (data: NewNote) => void;
}

export function NoteForm({ initial, submitLabel, onSubmit }: NoteFormProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');

  const canSave = title.trim().length > 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <TextInput
        style={styles.titleInput}
        placeholder="Título"
        placeholderTextColor={colors.textSubtle}
        value={title}
        onChangeText={setTitle}
        autoFocus={!initial}
      />
      <TextInput
        style={styles.contentInput}
        placeholder="Escribí tu nota…"
        placeholderTextColor={colors.textSubtle}
        value={content}
        onChangeText={setContent}
        multiline
        textAlignVertical="top"
      />
      <Pressable
        style={[styles.submit, !canSave && styles.submitDisabled]}
        disabled={!canSave}
        onPress={() => onSubmit({ title: title.trim(), content: content.trim() })}
      >
        <Text style={styles.submitText}>{submitLabel}</Text>
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
  submit: { backgroundColor: c.primary, borderRadius: 24, padding: 15, alignItems: 'center' },
  submitDisabled: { opacity: 0.4 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
