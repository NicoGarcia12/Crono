import { Ionicons } from "@expo/vector-icons";
import { Tabs, usePathname } from "expo-router";
import type { BottomTabBarButtonProps } from "expo-router/js-tabs";
import { PlatformPressable } from "expo-router/react-navigation";
import { useEffect } from "react";
import { Image, Platform, StyleSheet, View } from "react-native";

import { OnboardingTour } from "@/components/onboarding-tour";
import { TourProvider, useTourTarget } from "@/onboarding/tour-context";
import { TOUR_TARGETS } from "@/onboarding/tour-steps";
import { useAppSelector } from "@/store";
import { useThemeColors } from "@/theme/use-theme";

/** `nativeID` del contenido (pestañas + tab bar): en web es su `id`, para marcarlo `inert`. */
const TABS_CONTENT_ID = "crono-pestanas";

/**
 * Botón de pestaña medible por el recorrido guiado.
 *
 * 💡 Aprendizaje: `tabBarButton` deja reemplazar el botón que dibuja el tab bar
 * (por defecto, `PlatformPressable`). Lo envolvemos en un `View` propio para
 * tener una `ref` a una vista nativa real y poder medirla con `measureInWindow`;
 * el botón de adentro es el mismo de siempre, con sus props de accesibilidad
 * (rol "tab", seleccionado) y su `href` en web.
 */
function TourTabButton({
  tourId,
  ...props
}: BottomTabBarButtonProps & { tourId: string }) {
  const target = useTourTarget(tourId);
  return (
    <View {...target} style={tabStyles.slot}>
      <PlatformPressable {...props} />
    </View>
  );
}

/**
 * Barra de pestañas inferior (patrón estándar en mobile).
 * La carpeta se llama "(tabs)" — los paréntesis crean un "grupo" de rutas
 * que no agrega segmento a la URL (index sigue siendo la ruta raíz).
 *
 * También monta el recorrido guiado de primer uso (CRONO44): el `TourProvider`
 * abarca la Agenda y el tab bar, y el overlay se dibuja encima de los dos.
 * Este layout solo existe con la app desbloqueada y con nombre (ver `Gates`).
 */
export default function TabsLayout() {
  const colors = useThemeColors();
  const pathname = usePathname();
  // Estado de la sesión: true mientras el recorrido está abierto (tarjeta inicial o pasos).
  const tourOpen = useAppSelector((state) => state.settings.onboardingTourOpen);
  // El recorrido es de Agenda: si se reabre desde Perfil, aparece recién al llegar a '/'.
  const tourVisible = tourOpen && pathname === "/";

  // Web: con el recorrido abierto, `inert` saca la Agenda y el tab bar del orden de Tab
  // (aria-hidden solo los esconde del lector). react-native-web no reenvía `inert`
  // como prop, así que se pone directo en el elemento del DOM.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const content = document.getElementById(TABS_CONTENT_ID);
    if (!content) return;
    content.inert = tourVisible;
    return () => {
      content.inert = false;
    };
  }, [tourVisible]);

  return (
    <TourProvider>
      {/* Mientras el recorrido está abierto, lo de abajo queda fuera del alcance de los
          lectores de pantalla (Android: importantForAccessibility; web: aria-hidden + inert).
          En iOS lo resuelve `accessibilityViewIsModal` del overlay. */}
      <View
        nativeID={TABS_CONTENT_ID}
        style={tabStyles.fill}
        importantForAccessibility={tourVisible ? "no-hide-descendants" : "auto"}
        aria-hidden={tourVisible}
      >
        <Tabs
          screenOptions={{
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.textSubtle,
            tabBarStyle: {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
            },
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: "700" },
            // Isotipo chico a la izquierda del título en las 4 pestañas: espacio de marca real
            // (la barra superior de navegación) que ya existía, sin agregar pantallas nuevas.
            headerLeft: () => (
              <Image
                source={require("../../../assets/images/branding/crono-isotipo.png")}
                style={tabStyles.logo}
                resizeMode="contain"
                accessibilityRole="image"
                accessibilityLabel="Crono"
              />
            ),
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: "Agenda",
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="list" size={size} color={color} />
              ),
              tabBarButton: (props) => (
                <TourTabButton tourId={TOUR_TARGETS.tabAgenda} {...props} />
              ),
            }}
          />
          <Tabs.Screen
            name="calendario"
            options={{
              title: "Calendario",
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="calendar" size={size} color={color} />
              ),
              tabBarButton: (props) => (
                <TourTabButton tourId={TOUR_TARGETS.tabCalendar} {...props} />
              ),
            }}
          />
          <Tabs.Screen
            name="notas"
            options={{
              title: "Notas",
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="document-text" size={size} color={color} />
              ),
              tabBarButton: (props) => (
                <TourTabButton tourId={TOUR_TARGETS.tabNotes} {...props} />
              ),
            }}
          />
          <Tabs.Screen
            name="perfil"
            options={{
              title: "Perfil",
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="person" size={size} color={color} />
              ),
              tabBarButton: (props) => (
                <TourTabButton tourId={TOUR_TARGETS.tabProfile} {...props} />
              ),
            }}
          />
        </Tabs>
      </View>
      {tourVisible ? <OnboardingTour /> : null}
    </TourProvider>
  );
}

const tabStyles = StyleSheet.create({
  fill: { flex: 1 },
  slot: { flex: 1 },
  logo: { width: 28, height: 28, marginLeft: 16 },
});
