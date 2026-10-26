// Exercises made from open drawings: first a close-up of one hand on the bar, with the grip in
// words, then the two positions of the movement in turn.

import { AbsoluteFill, Img, Sequence, staticFile } from 'remotion';
import { OUTLINE, SIZE } from './figure.tsx';

type Rect = { x: number; y: number; width: number; height: number };

/** A part of an image in public/: the image, its size in px, and the rect to show. */
export type Shot = { src: string; size: { width: number; height: number }; rect: Rect };

export type DrawingProps = {
  closeUp: Shot;
  /** Arms up, then the end of the pull. */
  positions: [Shot, Shot];
  label: [string, string];
};

export const CLOSE_UP_FRAMES = 60;
export const POSITION_FRAMES = 30;

/** The rect of the image, as large as fits in the square and centred. */
function View({ src, size, rect }: Shot) {
  const scale = Math.min(SIZE / rect.width, SIZE / rect.height);
  const left = (SIZE - rect.width * scale) / 2 - rect.x * scale;
  const top = (SIZE - rect.height * scale) / 2 - rect.y * scale;
  return (
    <AbsoluteFill style={{ backgroundColor: '#ffffff', overflow: 'hidden' }}>
      <Img
        src={staticFile(src)}
        style={{ position: 'absolute', left, top, width: size.width * scale, height: size.height * scale }}
      />
    </AbsoluteFill>
  );
}

export function Drawing({ closeUp, positions, label }: DrawingProps) {
  return (
    <AbsoluteFill style={{ backgroundColor: '#ffffff' }}>
      <Sequence durationInFrames={CLOSE_UP_FRAMES}>
        <View {...closeUp} />
        <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 14 }}>
          <div
            style={{
              fontFamily: 'Helvetica, Arial, sans-serif',
              color: OUTLINE,
              backgroundColor: '#ffffff',
              padding: '4px 14px',
              borderRadius: 8,
              textAlign: 'center',
              lineHeight: 1.15,
            }}
          >
            <div style={{ fontSize: 30, fontWeight: 700 }}>{label[0]}</div>
            <div style={{ fontSize: 22 }}>{label[1]}</div>
          </div>
        </AbsoluteFill>
      </Sequence>
      {positions.map((shot, i) => (
        <Sequence key={i} from={CLOSE_UP_FRAMES + i * POSITION_FRAMES} durationInFrames={POSITION_FRAMES}>
          <View {...shot} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
