import { useMemo, useRef, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";

import { showError } from "@/components/confirm";
import { remindersAvailable } from "@/notifications/notifications";
import { explainAndRequestNotificationPermission } from "@/notifications/permission-prompt";
import { useAppDispatch } from "@/store";
import { saveDisplayName } from "@/store/settings-slice";
import type { ThemeColors } from "@/theme/theme";
import { useThemeColors } from "@/theme/use-theme";

/** Dónde quedan los datos según la plataforma: en web no hay "celular". */
const WELCOME_SUBTITLE =
  Platform.OS === "web"
    ? "Tu agenda personal: eventos, cumpleaños, aniversarios, citas médicas y notas, todo guardado en este navegador."
    : "Tu agenda personal: eventos, cumpleaños, aniversarios, citas médicas y notas, todo guardado en tu celular.";

/**
 * Bienvenida del primer uso: pide el nombre del usuario y lo guarda en SQLite.
 * Solo se muestra una vez (mientras displayName sea null).
 *
 * Si el entorno programa recordatorios, antes de guardar el nombre explica para
 * qué sirven los avisos y pide el permiso del sistema (CRONO44). El nombre se
 * guarda al final porque guardarlo desmonta esta pantalla y muestra la Agenda
 * con la tarjeta inicial del recorrido: así la tarjeta no aparece con un diálogo encima.
 */
export function NameSetup() {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const dispatch = useAppDispatch();
  const [name, setName] = useState("");
  // Evita repetir el diálogo/permiso si se toca "Empezar" dos veces seguidas.
  const [starting, setStarting] = useState(false);
  // Si guardar el nombre falla, el reintento solo vuelve a guardar: el permiso ya se explicó y se pidió.
  const permissionAsked = useRef(false);

  const canSave = name.trim().length > 0 && !starting;

  const start = async () => {
    if (!canSave) return;
    setStarting(true);
    if (remindersAvailable && !permissionAsked.current) {
      permissionAsked.current = true;
      await explainAndRequestNotificationPermission();
    }
    try {
      // unwrap(): sin él, un thunk rechazado no lanza y el fallo pasaba en silencio.
      await dispatch(saveDisplayName(name)).unwrap();
    } catch (error) {
      showError("No se pudo guardar tu nombre", error);
      // La pantalla sigue montada: se habilita "Empezar" para reintentar.
      setStarting(false);
    }
  };

  return (
    // KeyboardAvoidingView corre el contenido hacia arriba cuando aparece el teclado (necesario en iOS).
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Logotipo con la palabra "Crono" en vez del ícono de reloj: refuerza la marca ya
          desde la primera pantalla que ve un usuario nuevo. PNG con canal alfa real (ver
          docs/identidad-visual.md), así que se apoya sobre el fondo del tema sin recorte. */}
      <Image
        source={require("../../assets/images/branding/crono-logotipo.png")}
        style={styles.logo}
        resizeMode="contain"
        accessibilityRole="image"
        accessibilityLabel="Crono"
      />
      <Text style={styles.title}>¡Bienvenido a Crono!</Text>
      <Text style={styles.subtitle}>{WELCOME_SUBTITLE}</Text>
      <TextInput
        style={styles.input}
        placeholder="¿Cómo te llamás?"
        placeholderTextColor={colors.textSubtle}
        value={name}
        onChangeText={setName}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={() => void start()}
      />
      <Pressable
        style={[styles.button, !canSave && styles.buttonDisabled]}
        disabled={!canSave}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSave }}
        onPress={() => void start()}
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
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
      padding: 32,
      backgroundColor: c.surface,
    },
    logo: { width: 220, height: 88 },
    title: { fontSize: 26, fontWeight: "700", color: c.text },
    subtitle: {
      fontSize: 15,
      color: c.textMuted,
      textAlign: "center",
      lineHeight: 22,
    },
    input: {
      alignSelf: "stretch",
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
    buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  });
