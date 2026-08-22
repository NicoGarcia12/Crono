import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Image, StyleSheet } from 'react-native';

import { useThemeColors } from '@/theme/use-theme';

/**
 * Barra de pestañas inferior (patrón estándar en mobile).
 * La carpeta se llama "(tabs)" — los paréntesis crean un "grupo" de rutas
 * que no agrega segmento a la URL (index sigue siendo la ruta raíz).
 */
export default function TabsLayout() {
  const colors = useThemeColors();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        // Isotipo chico a la izquierda del título en las 4 pestañas: espacio de marca real
        // (la barra superior de navegación) que ya existía, sin agregar pantallas nuevas.
        headerLeft: () => (
          <Image
            source={require('../../../assets/images/branding/crono-isotipo.png')}
            style={tabHeaderStyles.logo}
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
          title: 'Agenda',
          tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendario"
        options={{
          title: 'Calendario',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notas"
        options={{
          title: 'Notas',
          tabBarIcon: ({ color, size }) => <Ionicons name="document-text" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const tabHeaderStyles = StyleSheet.create({
  logo: { width: 28, height: 28, marginLeft: 16 },
});
