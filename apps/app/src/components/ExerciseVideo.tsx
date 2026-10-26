// On the phone the video opens in the YouTube app; embedding will come with react-native-webview.

import { Linking, Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../theme';

type Props = {
  youtube: string;
  /** Height of the frame, as a share of the window; without it the frame takes the whole width. */
  height?: number;
};

export function ExerciseVideo({ youtube, height }: Props) {
  return (
    <Pressable
      style={[
        styles.frame,
        height ? { height, width: (height * 16) / 9, maxWidth: '100%', alignSelf: 'center' } : null,
      ]}
      onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${youtube}`)}
    >
      <Text style={styles.play}>▶</Text>
      <Text style={styles.text}>Guarda il video</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    aspectRatio: 16 / 9,
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  play: { color: colors.accent, fontSize: 48 },
  text: { color: colors.text, marginTop: 8 },
});
