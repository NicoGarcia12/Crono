import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput } from 'react-native';

import { useAppDispatch } from '@/store';
import { saveDisplayName } from '@/store/settings-slice';
import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Bienvenida del primer uso: pide el nombre del usuario y lo guarda en SQLite.
 * Solo se muestra una vez (mientras displayName sea null).
 */
export function NameSetup() {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const dispatch = useAppDispatch();
  const [name, setName] = useState('');

  const canSave = name.trim().length > 0;

  return (
    // KeyboardAvoidingView corre el contenido hacia arriba cuando aparece el teclado (necesario en iOS).
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Ionicons name="time" size={64} color={colors.primary} />
      <Text style={styles.title}>¡Bienvenido a Crono!</Text>
      <Text style={styles.subtitle}>
        Tu agenda personal: eventos, cumpleaños, aniversarios, citas médicas y notas, todo guardado
        solo en tu celular.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="¿Cómo te llamás?"
        placeholderTextColor={colors.textSubtle}
        value={name}
        onChangeText={setName}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={() => canSave && dispatch(saveDisplayName(name))}
      />
      <Pressable
        style={[styles.button, !canSave && styles.buttonDisabled]}
        disabled={!canSave}
        onPress={() => dispatch(saveDisplayName(name))}
      >
        <Text style={styles.buttonText}>Empezar</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
    backgroundColor: c.surface,
  },
  title: { fontSize: 26, fontWeight: '700', color: c.text },
  subtitle: { fontSize: 15, color: c.textMuted, textAlign: 'center', lineHeight: 22 },
  input: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: c.text,
  },
  button: {
    backgroundColor: c.primary,
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 24,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
