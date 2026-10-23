// Exercise demonstrations, stored with each exercise of the plan.
// - `youtube`: id of a chosen video, takes precedence over everything;
// - `gif`: animated GIFs from ExerciseDB (free API), one per part of a superset;
// - `photos`: without GIFs, free-exercise-db exercises (public domain),
//   each with start and end photos to alternate;
// - `search`: text to search YouTube for a video when there is nothing else.

export type ExerciseMedia = {
  youtube?: string;
  gif?: { id: string; name: string }[];
  photos?: string[];
  search?: string;
};

export type Demo = { kind: 'gif' | 'photo'; name: string; frames: string[] };

const EXERCISE_DB = 'https://static.exercisedb.dev/media';
const FREE_EXERCISE_DB = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';

/** The text to search YouTube for the exercise. */
export const youtubeSearch = (name: string, media?: ExerciseMedia) => media?.search ?? `${name} esecuzione corretta`;

/** The animated demonstrations of an exercise, one per part of a superset. */
export function demos(entry: ExerciseMedia | undefined, withGif = true): Demo[] {
  if (withGif && entry?.gif?.length) {
    return entry.gif.map((g) => ({ kind: 'gif', name: g.name, frames: [`${EXERCISE_DB}/${g.id}.gif`] }));
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
