// Shows an exercise demonstration: an animated GIF, or several frames
// (start and end of the movement) alternated as a short animation.

import type { Demo as DemoData } from '@gymapp/plan';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, space } from '../theme';

const INTERVAL_MS = 1200;

type Props = { demo: DemoData; onError?: () => void };

export function Demo({ demo, onError }: Props) {
  const { frames } = demo;
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (frames.length < 2) return;
    const timer = setInterval(() => setFrame((f) => (f + 1) % frames.length), INTERVAL_MS);
    return () => clearInterval(timer);
  }, [frames]);

  return (
    <View style={styles.frame}>
      <View style={[styles.image, demo.kind === 'gif' ? styles.gif : styles.photo]}>
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
      <Text style={styles.caption}>{demo.name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { gap: space(1) },
  image: { width: '100%', backgroundColor: '#ffffff', borderRadius: 12, overflow: 'hidden' },
  // ExerciseDB GIFs are 180×180: beyond twice that they get blurry.
  gif: { aspectRatio: 1, maxWidth: 360, alignSelf: 'center' },
  photo: { aspectRatio: 3 / 2 },
  caption: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
});
