import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  useTourMeasure,
  useTourRects,
  type TourRect,
  type TourTargetNode,
} from "@/onboarding/tour-context";
import {
  AGENDA_TOUR_STEPS,
  TOUR_NOTICE,
  TOUR_QUESTION,
} from "@/onboarding/tour-steps";
import { useWebDialogKeyboard } from "@/onboarding/use-web-dialog-keyboard";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  completeOnboardingTour,
  markOnboardingTourSeen,
  startOnboardingTour,
} from "@/store/settings-slice";
import type { ThemeColors, ThemeName } from "@/theme/theme";
import { useTheme } from "@/theme/use-theme";

/**
 * El primer paso aparece apenas llegan las medidas de todos los elementos
 * (`measureAll` resuelto) o, como tope, al vencer este tiempo: lo que pase
 * primero. `measureInWindow` responde de forma asíncrona (en nativo cruza al
 * hilo de UI; en web espera al layout del navegador): mostrar antes haría que
 * el indicador arranque en "1 de 3" y salte a "1 de 10". El tope cubre un
 * elemento que nunca responda.
 */
const SETTLE_TIMEOUT_MS = 600;
/** `nativeID` del diálogo: en web es su `id`, para la trampa de foco. */
const TOUR_DIALOG_ID = "crono-recorrido";
/** Aire alrededor del elemento resaltado. */
const HOLE_PADDING = 6;
/** Separación entre el elemento resaltado y el globo. */
const GAP = 12;
/** Margen mínimo del globo contra los bordes (además de las safe areas). */
const EDGE = 16;
/** En tablets y web ancha el globo no se estira de punta a punta. */
const MAX_BALLOON_WIDTH = 420;

/**
 * Recorrido guiado de primer uso sobre Agenda (CRONO44), estilo Driver.js:
 * oscurece la pantalla, deja "un agujero" sobre el elemento del paso y muestra
 * un globo con título, texto, "N de M" y los botones.
 *
 * Se muestra mientras `onboardingTourOpen` (estado de la sesión) sea true. La
 * primera vez arranca con una tarjeta inicial en el globo centrado: arriba
 * "Antes de empezar" (límites de los avisos y dónde quedan los datos) y debajo
 * la pregunta "¿Querés un recorrido por la app?". Apenas se ve, queda guardada
 * como vista en SQLite: si se cierra la app sin responder, no vuelve. "No,
 * gracias", Saltar o Terminar lo cierran; "Sí, mostrame" pasa al primer paso.
 * Perfil → "?" lo reabre directo en el primer paso, sin la tarjeta y solo para
 * esa sesión (`onboardingTourMode`).
 * Tiene que vivir dentro de un `TourProvider` (los elementos se registran ahí).
 */
export function OnboardingTour() {
  const open = useAppSelector((state) => state.settings.onboardingTourOpen);
  // Componente aparte: cada vez que el recorrido se reabre, arranca de cero (paso 1, medidas nuevas).
  return open ? <TourOverlay /> : null;
}

function TourOverlay() {
  const dispatch = useAppDispatch();
  const intro = useAppSelector(
    (state) => state.settings.onboardingTourMode === "intro",
  );
  const { name: themeName, colors } = useTheme();
  const styles = useMemo(
    () => makeStyles(colors, themeName),
    [colors, themeName],
  );
  const insets = useSafeAreaInsets();
  const screen = useWindowDimensions();
  const rects = useTourRects();
  const measurer = useTourMeasure();

  const [revealed, setRevealed] = useState(false);
  const [stepId, setStepId] = useState(AGENDA_TOUR_STEPS[0]?.id);
  /** Dónde quedó el propio overlay en la ventana: las medidas de los destinos se pasan a sus coordenadas. */
  const [frame, setFrame] = useState<TourRect | null>(null);
  const [balloonHeight, setBalloonHeight] = useState(0);
  const rootRef = useRef<TourTargetNode>(null);
  const titleRef = useRef<ComponentRef<typeof Text>>(null);
  const primaryRef = useRef<TourTargetNode>(null);

  // Al abrir, al rotar o al cambiar el tamaño de la ventana: medir todo de nuevo.
  // Al abrir, el recorrido se muestra cuando llegaron esas medidas.
  useEffect(() => {
    if (!measurer) return;
    let active = true;
    void measurer.measureAll().then(() => {
      if (active) setRevealed(true);
    });
    return () => {
      active = false;
    };
  }, [measurer, screen.width, screen.height]);

  useEffect(() => {
    const timer = setTimeout(() => setRevealed(true), SETTLE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  // Se omiten los pasos cuyo elemento no está montado o mide 0 (oculto).
  const visibleSteps = AGENDA_TOUR_STEPS.filter((step) => {
    const rect = rects[step.target];
    return rect !== undefined && rect.width > 0 && rect.height > 0;
  });
  // El paso actual se guarda por id: si su elemento desaparece, se sigue con el próximo visible.
  const wanted = AGENDA_TOUR_STEPS.findIndex((step) => step.id === stepId);
  const found = visibleSteps.findIndex(
    (step) => AGENDA_TOUR_STEPS.indexOf(step) >= wanted,
  );
  const index = found === -1 ? visibleSteps.length - 1 : found;
  const step = visibleSteps[index];
  // La tarjeta inicial va en el globo centrado: no resalta nada.
  const target = intro ? undefined : step?.target;

  // El elemento pudo moverse desde la última medida (ej. el teclado o un filtro nuevo).
  useEffect(() => {
    if (target) void measurer?.measure(target);
  }, [measurer, target]);

  // Guardado "visto" inmediato: apenas se revela la tarjeta inicial queda '1' en SQLite,
  // así no vuelve aunque se cierre la app sin responder. Corre una sola vez por apertura:
  // `revealed` solo pasa de false a true, e `intro` solo de true a false.
  useEffect(() => {
    if (revealed && intro) void dispatch(markOnboardingTourSeen());
  }, [dispatch, revealed, intro]);

  const finish = () => {
    void dispatch(completeOnboardingTour());
  };
  // Web: Escape = Saltar (en la tarjeta inicial, "No, gracias"), y Tab/Shift+Tab no salen del globo.
  useWebDialogKeyboard(TOUR_DIALOG_ID, revealed, finish);

  // Accesibilidad: con la tarjeta inicial y con cada paso, el lector de pantalla arranca
  // por el primer título; en web, el foco de teclado queda en el botón principal
  // (Sí, mostrame / Siguiente / Terminar).
  useEffect(() => {
    if (!revealed) return;
    if (Platform.OS === "web") {
      primaryRef.current?.focus();
    } else if (titleRef.current) {
      AccessibilityInfo.sendAccessibilityEvent(titleRef.current, "focus");
    }
  }, [revealed, intro, step?.id]);

  // La tarjeta inicial no depende de los pasos; los pasos esperan a tener alguno medido.
  const content = intro ? TOUR_QUESTION : step;
  if (!revealed || !content) return null;

  const total = visibleSteps.length;
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const goTo = (offset: number) => {
    const next = visibleSteps[index + offset];
    if (next) setStepId(next.id);
  };
  // "Sí, mostrame": el mismo overlay pasa de la tarjeta al primer paso (sin cerrarse ni volver a medir).
  const accept = () => {
    dispatch(startOnboardingTour());
  };

  const measureFrame = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    rootRef.current?.measureInWindow((x, y) =>
      setFrame({ x, y, width, height }),
    );
  };

  const area = frame ?? {
    x: 0,
    y: 0,
    width: screen.width,
    height: screen.height,
  };

  // Rectángulo a destacar, en coordenadas del overlay y recortado a sus bordes.
  const rect = target ? rects[target] : undefined;
  let hole: TourRect | null = null;
  if (rect) {
    const left = Math.max(0, rect.x - area.x - HOLE_PADDING);
    const top = Math.max(0, rect.y - area.y - HOLE_PADDING);
    const right = Math.min(
      area.width,
      rect.x - area.x + rect.width + HOLE_PADDING,
    );
    const bottom = Math.min(
      area.height,
      rect.y - area.y + rect.height + HOLE_PADDING,
    );
    hole = {
      x: left,
      y: top,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
    };
  }

  // Globo: abajo del elemento si entra, si no arriba; si no entra en ningún lado
  // (ej. la lista ocupa casi toda la pantalla), pegado al borde con más lugar.
  // Las safe areas (notch, barra de gestos) se respetan siempre.
  const usableWidth = area.width - insets.left - insets.right - EDGE * 2;
  const balloonWidth = Math.min(MAX_BALLOON_WIDTH, usableWidth);
  const balloonLeft = insets.left + EDGE + (usableWidth - balloonWidth) / 2;
  const minTop = insets.top + EDGE;
  const minBottom = insets.bottom + EDGE;
  // Tope de alto: en pantallas chicas (o con letra grande) los textos se desplazan
  // dentro del globo y los botones quedan siempre a la vista.
  const balloonMaxHeight = Math.max(0, area.height - minTop - minBottom);
  let placement: { top: number } | { bottom: number };
  if (!hole) {
    placement = { top: Math.max(minTop, (area.height - balloonHeight) / 2) };
  } else {
    const spaceBelow = area.height - minBottom - (hole.y + hole.height + GAP);
    const spaceAbove = hole.y - GAP - minTop;
    if (balloonHeight <= spaceBelow)
      placement = { top: hole.y + hole.height + GAP };
    else if (balloonHeight <= spaceAbove)
      placement = { bottom: area.height - hole.y + GAP };
    else
      placement =
        spaceBelow >= spaceAbove ? { bottom: minBottom } : { top: minTop };
  }

  return (
    // Cubre toda la pantalla: además de oscurecer, frena los toques a lo de abajo
    // (también dentro del "agujero"), así no se puede usar la app a medio recorrido.
    <View
      ref={rootRef}
      nativeID={TOUR_DIALOG_ID}
      style={StyleSheet.absoluteFill}
      onLayout={measureFrame}
      role="dialog"
      aria-modal
      accessibilityViewIsModal
    >
      {hole ? (
        <>
          {/* Spotlight con 4 rectángulos oscuros alrededor del elemento: funciona igual en
              web y nativo, sin SVG ni máscaras. */}
          <View
            style={[
              styles.scrim,
              { top: 0, left: 0, right: 0, height: hole.y },
            ]}
          />
          <View
            style={[
              styles.scrim,
              { top: hole.y + hole.height, left: 0, right: 0, bottom: 0 },
            ]}
          />
          <View
            style={[
              styles.scrim,
              { top: hole.y, height: hole.height, left: 0, width: hole.x },
            ]}
          />
          <View
            style={[
              styles.scrim,
              {
                top: hole.y,
                height: hole.height,
                left: hole.x + hole.width,
                right: 0,
              },
            ]}
          />
          <View
            style={[
              styles.ring,
              {
                top: hole.y,
                left: hole.x,
                width: hole.width,
                height: hole.height,
              },
            ]}
          />
        </>
      ) : (
        <View style={[styles.scrim, StyleSheet.absoluteFill]} />
      )}

      <View
        style={[
          styles.balloon,
          {
            left: balloonLeft,
            width: balloonWidth,
            maxHeight: balloonMaxHeight,
          },
          placement,
        ]}
        onLayout={(event) => setBalloonHeight(event.nativeEvent.layout.height)}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          {intro ? (
            // Primero los avisos: se leen aunque se responda "No, gracias", y no se repiten en los pasos.
            <View style={[styles.texts, styles.notice]}>
              <Text
                ref={titleRef}
                style={styles.title}
                accessibilityRole="header"
              >
                {TOUR_NOTICE.title}
              </Text>
              <Text style={styles.body}>{TOUR_NOTICE.body}</Text>
            </View>
          ) : null}
          {/* En web el lector anuncia el paso nuevo (el foco queda en el botón); en nativo se mueve el foco al título. */}
          <View
            style={styles.texts}
            aria-live={Platform.OS === "web" ? "polite" : undefined}
          >
            <Text
              ref={intro ? undefined : titleRef}
              style={styles.title}
              accessibilityRole="header"
            >
              {content.title}
            </Text>
            <Text style={styles.body}>{content.body}</Text>
          </View>
        </ScrollView>

        {intro ? (
          // La tarjeta inicial no es un paso: sin "N de M", solo las dos respuestas.
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={finish}
              style={({ pressed }) => [
                styles.button,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.skipText}>No, gracias</Text>
            </Pressable>
            <Pressable
              ref={primaryRef}
              accessibilityRole="button"
              onPress={accept}
              style={({ pressed }) => [
                styles.button,
                styles.primaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryText}>Sí, mostrame</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.footer}>
            <Text
              style={styles.counter}
              accessibilityLabel={`Paso ${index + 1} de ${total}`}
            >
              {`${index + 1} de ${total}`}
            </Text>
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Saltar recorrido"
                hitSlop={8}
                onPress={finish}
                style={({ pressed }) => [
                  styles.button,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.skipText}>Saltar</Text>
              </Pressable>
              {isFirst ? null : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => goTo(-1)}
                  style={({ pressed }) => [
                    styles.button,
                    styles.secondaryButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.secondaryText}>Anterior</Text>
                </Pressable>
              )}
              <Pressable
                ref={primaryRef}
                accessibilityRole="button"
                onPress={isLast ? finish : () => goTo(1)}
                style={({ pressed }) => [
                  styles.button,
                  styles.primaryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.primaryText}>
                  {isLast ? "Terminar" : "Siguiente"}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors, themeName: ThemeName) =>
  StyleSheet.create({
    // En oscuro el fondo ya es casi negro: hace falta más opacidad para que se note el foco.
    scrim: {
      position: "absolute",
      backgroundColor:
        themeName === "oscuro"
          ? "rgba(0, 0, 0, 0.78)"
          : "rgba(16, 24, 40, 0.66)",
    },
    ring: {
      position: "absolute",
      borderWidth: 2,
      borderColor: c.primary,
      borderRadius: 12,
      pointerEvents: "none",
    },
    balloon: {
      position: "absolute",
      gap: 12,
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      elevation: 8,
      shadowColor: c.shadow,
      shadowOpacity: 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    // flexGrow 0 + flexShrink 1: el ScrollView mide lo que su contenido, pero se achica
    // (y pasa a desplazarse) cuando el globo llega a su alto máximo.
    scroll: { flexGrow: 0, flexShrink: 1 },
    scrollContent: { gap: 12 },
    texts: { gap: 6 },
    notice: { padding: 12, borderRadius: 12, backgroundColor: c.surfaceAlt },
    title: { fontSize: 17, fontWeight: "700", color: c.text },
    body: { fontSize: 14.5, lineHeight: 21, color: c.textMuted },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    // flexShrink 0: en pantallas angostas los botones bajan de fila, pero "4 de 10" no se parte.
    counter: { fontSize: 13, color: c.textSubtle, flexShrink: 0 },
    actions: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "flex-end",
      alignItems: "center",
      gap: 8,
      flexShrink: 1,
    },
    button: { borderRadius: 12, paddingVertical: 9, paddingHorizontal: 12 },
    primaryButton: { backgroundColor: c.primary, paddingHorizontal: 16 },
    secondaryButton: { backgroundColor: c.surfaceAlt },
    pressed: { opacity: 0.75 },
    skipText: { fontSize: 14, fontWeight: "600", color: c.textMuted },
    secondaryText: { fontSize: 14, fontWeight: "700", color: c.text },
    primaryText: { fontSize: 14, fontWeight: "700", color: "#ffffff" },
  });
