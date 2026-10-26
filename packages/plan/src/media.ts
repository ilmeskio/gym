// Exercise demonstrations, stored with each exercise of the plan.
// - `youtube`: id of a chosen video, takes precedence over everything;
// - `gif`: animated GIFs, one per part of a superset: from ExerciseDB (free API), or our own
//   animations (`source: 'gym'`, made with Remotion in packages/animations) for the exercises
//   ExerciseDB does not have;
// - `photos`: without GIFs, free-exercise-db exercises (public domain),
//   each with start and end photos to alternate;
// - `search`: text to search YouTube for a video when there is nothing else.

export type Gif = { id: string; name: string; source?: 'gym' };

export type ExerciseMedia = {
  youtube?: string;
  gif?: Gif[];
  photos?: string[];
  search?: string;
};

export type Demo = { kind: 'gif' | 'photo'; name: string; frames: string[] };

const EXERCISE_DB = 'https://static.exercisedb.dev/media';
const FREE_EXERCISE_DB = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';
// Published with the web app, from apps/app/public/animations.
const OWN_ANIMATIONS = 'https://consiglio.fyi/gym/animations';

/** Our own animations, for the exercises ExerciseDB does not have. */
const ANIMATIONS: Gif[] = [
  { id: 'hollow-hold', name: 'hollow body hold (barchetta)', source: 'gym' },
  { id: 'straight-arm-plank', name: 'straight arm plank (plank braccia tese)', source: 'gym' },
  { id: 'horizontal-leg-press', name: 'horizontal leg press (leg press orizzontale)', source: 'gym' },
  // Made from open drawings, with a close-up of the grip: the names keep the credit the licences ask for.
  {
    id: 'underhand-pulldown',
    name: 'underhand lat pulldown (lat machine presa supina), disegno di Franpol, wger.de, CC BY-SA 4.0',
    source: 'gym',
  },
  {
    id: 'wide-grip-pulldown',
    name: 'wide grip lat pulldown (lat machine presa prona), disegni di Everkinetic, CC BY-SA 3.0',
    source: 'gym',
  },
];

/** Our own animations whose name has every word of the query. */
export function findAnimations(query: string): Gif[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return ANIMATIONS.filter((a) => words.every((w) => a.name.toLowerCase().includes(w)));
}

export const gifUrl = (gif: Gif) =>
  gif.source === 'gym' ? `${OWN_ANIMATIONS}/${gif.id}.gif` : `${EXERCISE_DB}/${gif.id}.gif`;

/** The text to search YouTube for the exercise. */
export const youtubeSearch = (name: string, media?: ExerciseMedia) => media?.search ?? `${name} esecuzione corretta`;

/** The animated demonstrations of an exercise, one per part of a superset. */
export function demos(entry: ExerciseMedia | undefined, withGif = true): Demo[] {
  if (withGif && entry?.gif?.length) {
    return entry.gif.map((g) => ({ kind: 'gif', name: g.name, frames: [gifUrl(g)] }));
  }
  return (entry?.photos ?? []).map((exercise) => ({
    kind: 'photo',
    name: exercise.replaceAll('_', ' '),
    frames: [0, 1].map((n) => `${FREE_EXERCISE_DB}/${exercise}/${n}.jpg`),
  }));
}

/** Extracts the id from a YouTube link (watch, youtu.be, shorts, embed), or returns it if it is already an id. */
export function youtubeId(link: string): string | undefined {
  const clean = link.trim();
  if (/^[\w-]{11}$/.test(clean)) return clean;
  const m = /(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/.exec(clean);
  return m?.[1];
}
