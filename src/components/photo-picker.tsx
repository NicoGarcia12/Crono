import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { pickAndSavePhoto } from '@/media/photos';
import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Círculo con la foto elegida (o un ícono de placeholder). Tocarlo abre el
 * selector de imágenes; con foto puesta aparece una cruz para sacarla.
 */

interface PhotoPickerProps {
  uri: string | null;
  onChange: (uri: string | null) => void;
  accessibilityLabel: string;
  /** Prefijo del nombre de archivo al guardar (distingue fotos de evento vs. de perfil). */
  filePrefix: string;
  size?: number;
}

export function PhotoPicker({ uri, onChange, accessibilityLabel, filePrefix, size = 72 }: PhotoPickerProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const pick = async () => {
    const saved = await pickAndSavePhoto(filePrefix);
    if (saved) onChange(saved);
  };

  return (
    <View style={styles.wrapper}>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}
        onPress={pick}
      >
        {uri ? (
          <Image source={{ uri }} style={[styles.image, { borderRadius: size / 2 }]} />
        ) : (
          <Ionicons name="camera" size={size * 0.4} color={colors.primary} />
        )}
      </Pressable>
      {uri ? (
        <Pressable
          accessibilityLabel={`Quitar foto`}
          style={styles.remove}
          hitSlop={8}
          onPress={() => onChange(null)}
        >
          <Ionicons name="close" size={14} color="#fff" />
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrapper: { alignSelf: 'flex-start' },
    circle: {
      backgroundColor: `${c.primary}18`,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    image: { width: '100%', height: '100%' },
    remove: {
      position: 'absolute',
      top: -4,
      right: -4,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: c.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
