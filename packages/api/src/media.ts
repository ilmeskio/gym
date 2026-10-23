// Finding demonstrations for an exercise: animated GIFs from ExerciseDB (free API) and
// start and end photos from free-exercise-db (public domain), as the app shows them.

export type MediaCandidate = { id: string; name: string; preview: string };
export type MediaCandidates = { gif: MediaCandidate[]; photos: MediaCandidate[] };
export type MediaSearch = (query: string, limit: number) => Promise<MediaCandidates>;

const EXERCISE_DB = 'https://oss.exercisedb.dev/api/v1/exercises';
const FREE_EXERCISE_DB = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main';

type FreeExercise = { id: string; name: string; images: string[] };

export function mediaSearch(fetcher: typeof fetch = fetch): MediaSearch {
  // The free-exercise-db list is one file of about 1 MB: fetched once per instance.
  let photos: Promise<FreeExercise[]> | undefined;
  const photoList = () => {
    photos ??= fetcher(`${FREE_EXERCISE_DB}/dist/exercises.json`)
      .then((r) => (r.ok ? (r.json() as Promise<FreeExercise[]>) : []))
      .catch(() => {
        photos = undefined;
        return [];
      });
    return photos;
  };

  return async (query, limit) => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const [gif, list] = await Promise.all([
      fetcher(`${EXERCISE_DB}/search?${new URLSearchParams({ search: query, limit: String(limit) })}`)
        .then(async (r) => {
          if (!r.ok) return [];
          const { data } = (await r.json()) as { data: { exerciseId: string; name: string; gifUrl: string }[] };
          return data.map((e) => ({ id: e.exerciseId, name: e.name, preview: e.gifUrl }));
        })
        .catch(() => []),
      photoList(),
    ]);
    return {
      gif: gif.slice(0, limit),
      photos: list
        .filter((e) => words.every((w) => e.name.toLowerCase().includes(w)))
        .slice(0, limit)
        .map((e) => ({ id: e.id, name: e.name, preview: `${FREE_EXERCISE_DB}/exercises/${e.images[0]}` })),
    };
  };
}
