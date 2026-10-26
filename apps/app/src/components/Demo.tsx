// Shows an exercise demonstration: an animated GIF, or several frames
// (start and end of the movement) alternated as a short animation.

import type { Demo as DemoData } from '@gymapp/plan';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, space } from '../theme';

const INTERVAL_MS = 1200;

type Props = {
  demo: DemoData;
  /** Height of the image, as a share of the window; without it the image takes the whole width. */
  height?: number;
  /**
   * The dataset's name under the image: useful when several demonstrations sit side by side.
   * The credit an open licence asks for shows anyway.
   */
  caption?: boolean;
  onError?: () => void;
};

export function Demo({ demo, height, caption = true, onError }: Props) {
  const { frames } = demo;
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (frames.length < 2) return;
    const timer = setInterval(() => setFrame((f) => (f + 1) % frames.length), INTERVAL_MS);
    return () => clearInterval(timer);
  }, [frames]);

  return (
    <View style={styles.frame}>
      <View
        style={[
          styles.image,
          demo.kind === 'gif' ? styles.gif : styles.photo,
          height ? { height, width: height * (demo.kind === 'gif' ? 1 : 3 / 2) } : null,
        ]}
      >
        {frames.map((uri, i) => (
          <Image
            key={uri}
            source={uri}
            accessibilityLabel={demo.name}
            contentFit="contain"
            onError={onError}
            style={[StyleSheet.absoluteFill, { opacity: i === frame ? 1 : 0 }]}
          />
        ))}
      </View>
      {caption || demo.credit ? (
        <Text style={styles.caption}>{[caption && demo.name, demo.credit].filter(Boolean).join(' · ')}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { gap: space(1), alignItems: 'center' },
  image: { width: '100%', maxWidth: '100%', backgroundColor: '#ffffff', borderRadius: 12, overflow: 'hidden' },
  // ExerciseDB GIFs are 180×180: beyond twice that they get blurry.
  gif: { aspectRatio: 1, maxWidth: 360 },
  photo: { aspectRatio: 3 / 2 },
  caption: { color: colors.textMuted, fontSize: 11, textAlign: 'center' },
});
