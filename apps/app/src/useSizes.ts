import { useWindowDimensions } from 'react-native';
import { sizesFor } from './sizes';

/** Sizes for the current window (see sizes.ts); they follow rotation and resizing. */
export function useSizes() {
  const { width, height } = useWindowDimensions();
  return sizesFor(width, height);
}
