import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

type Props = {
  youtube: string;
  /** Height of the frame, as a share of the window; without it the frame takes the whole width. */
  height?: number;
};

export function ExerciseVideo({ youtube, height }: Props) {
  return (
    <View
      style={[
        styles.frame,
        height ? { height, width: (height * 16) / 9, maxWidth: '100%', alignSelf: 'center' } : null,
      ]}
    >
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${youtube}?rel=0&playsinline=1`}
        title="Video dell'esercizio"
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        style={{ border: 0, width: '100%', height: '100%' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { aspectRatio: 16 / 9, width: '100%', backgroundColor: colors.surface, borderRadius: 12, overflow: 'hidden' },
});
