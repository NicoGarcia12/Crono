import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { showError } from '@/components/confirm';
import { pickPhoto } from '@/media/photos';
import type { ThemeColors } from '@/theme/theme';
import { useThemeColors } from '@/theme/use-theme';

/**
 * Círculo con la foto elegida (o un ícono de placeholder). Tocarlo abre el
 * selector de imágenes; con foto puesta aparece una cruz para sacarla.
 */

interface PhotoPickerProps {
  uri: string | null;
  /**
   * Recibe la foto elegida (URI temporal) o null para quitarla. Puede ser asíncrono: si
   * rechaza, el selector avisa el error y la foto anterior queda como estaba.
   */
  onChange: (uri: string | null) => void | Promise<void>;
  accessibilityLabel: string;
  size?: number;
}

export function PhotoPicker({ uri, onChange, accessibilityLabel, size = 72 }: PhotoPickerProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const busy = useRef(false);

  const pick = async () => {
    // El selector sólo entrega la elección (URI temporal): copiar y guardar es del dueño de onChange.
    const picked = await pickPhoto();
    if (picked) await onChange(picked);
  };

  /** Un solo guardado a la vez; si falla se avisa en vez de dejar la promesa sin atender. */
  const run = async (action: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await action();
    } catch (error: unknown) {
      showError('No se pudo guardar la foto', error);
    } finally {
      busy.current = false;
    }
  };

  return (
    <View style={styles.wrapper}>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}
        onPress={() => void run(pick)}
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
          onPress={() => void run(async () => { await onChange(null); })}
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
