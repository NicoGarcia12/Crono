import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import type { NewNote, Note } from '@/types';

/** Formulario de nota, compartido entre crear y editar. */
interface NoteFormProps {
  initial?: Note;
  submitLabel: string;
  onSubmit: (data: NewNote) => void;
}

export function NoteForm({ initial, submitLabel, onSubmit }: NoteFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');

  const canSave = title.trim().length > 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <TextInput
        style={styles.titleInput}
        placeholder="Título"
        placeholderTextColor="#999"
        value={title}
        onChangeText={setTitle}
        autoFocus={!initial}
      />
      <TextInput
        style={styles.contentInput}
        placeholder="Escribí tu nota…"
        placeholderTextColor="#999"
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa' },
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  titleInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e2e2',
    borderRadius: 12,
    padding: 13,
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  contentInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e2e2',
    borderRadius: 12,
    padding: 13,
    fontSize: 15,
    color: '#1a1a2e',
    minHeight: 220,
    lineHeight: 21,
  },
  submit: { backgroundColor: '#208AEF', borderRadius: 24, padding: 15, alignItems: 'center' },
  submitDisabled: { opacity: 0.4 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
