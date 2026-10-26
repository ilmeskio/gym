import { describe, expect, it } from 'vitest';
import {
  currentWeek,
  demos,
  findAnimations,
  holdPhases,
  intervalPhases,
  kgFromPlan,
  planProblems,
  prescription,
  readRepMaxSearch,
  readRest,
  readSets,
  repMaxAdvice,
  session,
  stepDetails,
  youtubeId,
} from './index.ts';
import type { Plan } from './index.ts';

describe('readSets', () => {
  it('reads sets and a rep range', () => {
    expect(readSets('3x8/10')).toEqual({
      sets: { min: 3, max: 3 },
      target: { kind: 'reps', min: 8, max: 10 },
    });
  });

  it('reads an isometric hold in seconds', () => {
    expect(readSets('3x20/30"')).toEqual({
      sets: { min: 3, max: 3 },
      target: { kind: 'seconds', min: 20, max: 30 },
    });
  });

  it('reads a range of sets', () => {
    expect(readSets('3/4x5/8 ')).toEqual({
      sets: { min: 3, max: 4 },
      target: { kind: 'reps', min: 5, max: 8 },
    });
  });

  it('reads sets to failure and keeps the rest as a note', () => {
    expect(readSets('1xmax 2 x metà rep prima serie')).toEqual({
      sets: { min: 1, max: 1 },
      target: { kind: 'max' },
      note: '2 x metà rep prima serie',
    });
  });

  it('keeps the second half of a superset as a note', () => {
    expect(readSets('3x8/12+8/12')).toEqual({
      sets: { min: 3, max: 3 },
      target: { kind: 'reps', min: 8, max: 12 },
      note: '+8/12',
    });
  });

  it('reads a timed hold that follows in a superset, per side', () => {
    expect(readSets('3x20/30+20" a lato side plank')).toEqual({
      sets: { min: 3, max: 3 },
      target: { kind: 'reps', min: 20, max: 30 },
      note: '+20" a lato side plank',
      then: { seconds: 20, perSide: true, name: 'side plank' },
    });
    expect(readSets('3x20/30"+20" a lato side plank').then).toEqual({ seconds: 20, perSide: true, name: 'side plank' });
    expect(readSets('3x30"+15" hollow').then).toEqual({ seconds: 15, perSide: false, name: 'hollow' });
  });

  it('reads rounds of reps against the clock', () => {
    expect(readSets('5 rep ogni 30" x 4 min')).toEqual({
      note: '5 rep ogni 30" x 4 min',
      intervals: { reps: 5, every: 30, minutes: 4 },
    });
    expect(readSets('6 rep ogni 30"x5min').intervals).toEqual({ reps: 6, every: 30, minutes: 5 });
  });

  it('leaves free text as a note', () => {
    expect(readSets('uguale 5min')).toEqual({ note: 'uguale 5min' });
    expect(readSets(undefined)).toEqual({});
  });
});

describe('holdPhases', () => {
  it('prepares, then holds for the seconds chosen', () => {
    expect(holdPhases(readSets('3x30"'), 25)).toEqual([
      { kind: 'prepare', seconds: 5 },
      { kind: 'work', seconds: 25 },
    ]);
  });

  it('goes on with the second part of the superset, one side at a time', () => {
    expect(holdPhases(readSets('3x20/30"+20" a lato side plank'), 30)).toEqual([
      { kind: 'prepare', seconds: 5 },
      { kind: 'work', seconds: 30 },
      { kind: 'prepare', seconds: 5, label: 'Side plank, lato sinistro' },
      { kind: 'work', seconds: 20, label: 'Side plank, lato sinistro' },
      { kind: 'prepare', seconds: 5, label: 'Side plank, lato destro' },
      { kind: 'work', seconds: 20, label: 'Side plank, lato destro' },
    ]);
  });

  it('holds the second part for the seconds chosen instead of the plan', () => {
    const phases = holdPhases(readSets('3x20/30"+20" a lato side plank'), 30, 35);
    expect(phases.filter((p) => p.kind === 'work').map((p) => p.seconds)).toEqual([30, 35, 35]);
  });
});

describe('intervalPhases', () => {
  it('prepares, then one round every so many seconds until the minutes are over', () => {
    const phases = intervalPhases({ reps: 5, every: 30, minutes: 2 });
    expect(phases).toEqual([
      { kind: 'prepare', seconds: 5 },
      { kind: 'work', seconds: 30, label: 'Giro 1 di 4: 5 ripetizioni' },
      { kind: 'work', seconds: 30, label: 'Giro 2 di 4: 5 ripetizioni' },
      { kind: 'work', seconds: 30, label: 'Giro 3 di 4: 5 ripetizioni' },
      { kind: 'work', seconds: 30, label: 'Giro 4 di 4: 5 ripetizioni' },
    ]);
  });
});

describe('readRest', () => {
  it('converts minutes and seconds into seconds', () => {
    expect(readRest("1'30")).toBe(90);
    expect(readRest("2'")).toBe(120);
    expect(readRest('40"')).toBe(40);
    expect(readRest(undefined)).toBeUndefined();
    expect(readRest('a piacere')).toBeUndefined();
  });
});

const plan: Plan = {
  title: 'Test',
  startDate: '2026-09-27',
  weekCount: 3,
  days: [
    {
      id: 'A',
      title: 'Giorno A',
      exercises: [
        {
          id: 'squat',
          name: 'Squat',
          weeks: [{ load: '8 kg', setsReps: '3x8/10', rest: "1'30" }, { setsReps: '4x8/10' }, {}],
        },
        {
          id: 'raises',
          name: 'Alzate laterali',
          weeks: [{ load: 'trova 12 rm', setsReps: 'limitati a questo' }, { setsReps: '3x10/12' }, {}],
        },
      ],
    },
  ],
};

describe('prescription', () => {
  it('fills empty fields from the previous week', () => {
    expect(prescription(plan.days[0].exercises[0], 3)).toEqual({
      load: '8 kg',
      setsReps: '4x8/10',
      rest: "1'30",
    });
  });

  it('does not carry over the load search nor the "limitati a questo" that goes with it', () => {
    const lat = {
      id: 'lat',
      name: 'Lat machine',
      weeks: [{ load: 'trova 10 rm', setsReps: 'limitati a questo', rest: "1'30" }, {}],
    };
    expect(prescription(lat, 2)).toEqual({ rest: "1'30" });
  });

  it('does not carry over a load to be found', () => {
    expect(prescription(plan.days[0].exercises[1], 2)).toEqual({ setsReps: '3x10/12' });
  });
});

describe('session', () => {
  it("lines up the day's exercises with the week's prescription", () => {
    const steps = session(plan, 'A', 2);
    expect(steps.map((s) => [s.exercise.id, s.position, s.total])).toEqual([
      ['squat', 1, 2],
      ['raises', 2, 2],
    ]);
    expect(steps[0].sets.sets).toEqual({ min: 4, max: 4 });
    expect(steps[0].restSeconds).toBe(90);
  });

  it('rejects a missing day or week', () => {
    expect(() => session(plan, 'Z', 1)).toThrow();
    expect(() => session(plan, 'A', 4)).toThrow();
  });
});

describe('youtubeId', () => {
  it('recognises the common link formats', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('non è un link')).toBeUndefined();
  });
});

describe('readRepMaxSearch', () => {
  it('recognises the variants of "trova N rm"', () => {
    expect(readRepMaxSearch('trova 12 rm( ovvero carico max 12 rep)')).toBe(12);
    expect(readRepMaxSearch('trova 15rm')).toBe(15);
    expect(readRepMaxSearch('trova 12rm entrambi')).toBe(12);
    expect(readRepMaxSearch('troviamo resistenza')).toBeUndefined();
    expect(readRepMaxSearch('8 kg')).toBeUndefined();
    expect(readRepMaxSearch(undefined)).toBeUndefined();
  });
});

describe('repMaxAdvice', () => {
  it('says whether to go up, go down, or that the load is found', () => {
    expect(repMaxAdvice(12, 15)).toBe('increase');
    expect(repMaxAdvice(12, 12)).toBe('found');
    expect(repMaxAdvice(12, 9)).toBe('decrease');
  });
});

describe('session with a load to find', () => {
  it('asks to find the load in the first week', () => {
    const [, raises] = session(plan, 'A', 1);
    expect(raises.findRepMax).toBe(12);
    expect(raises.useRepMax).toBeUndefined();
  });

  it('uses the load found in the following weeks', () => {
    const [squat, raises] = session(plan, 'A', 2);
    expect(raises.findRepMax).toBeUndefined();
    expect(raises.useRepMax).toBe(12);
    expect(squat.useRepMax).toBeUndefined();
  });
});

describe('demos', () => {
  const catalog = {
    superset: {
      search: 'superset',
      gif: [{ id: 'abc1234', name: 'dumbbell hammer curl' }],
      photos: ['Hammer_Curls', 'Triceps_Pushdown_-_Rope_Attachment'],
    },
    photosOnly: { search: 'photos', photos: ['Plank'] },
  };

  it('prefers the ExerciseDB GIFs', () => {
    expect(demos(catalog.superset)).toEqual([
      { kind: 'gif', name: 'dumbbell hammer curl', frames: ['https://static.exercisedb.dev/media/abc1234.gif'] },
    ]);
  });

  it('otherwise alternates start and end photos, one per part of a superset', () => {
    expect(demos(catalog.photosOnly)).toEqual([
      {
        kind: 'photo',
        name: 'Plank',
        frames: [
          'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Plank/0.jpg',
          'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Plank/1.jpg',
        ],
      },
    ]);
    expect(demos(undefined)).toEqual([]);
  });

  it('mixes our own animations with the ExerciseDB GIFs, in the order of the superset', () => {
    const media = {
      gif: [
        { id: 'hollow-hold', name: 'barchetta', source: 'gym' as const },
        { id: 'RKjH6Lt', name: 'side bridge' },
      ],
    };
    expect(demos(media)).toEqual([
      { kind: 'gif', name: 'barchetta', frames: ['https://consiglio.fyi/gym/animations/hollow-hold.gif'] },
      { kind: 'gif', name: 'side bridge', frames: ['https://static.exercisedb.dev/media/RKjH6Lt.gif'] },
    ]);
  });

  it('falls back to photos when GIFs cannot be used', () => {
    expect(demos(catalog.superset, false).map((d) => [d.kind, d.name])).toEqual([
      ['photo', 'Hammer Curls'],
      ['photo', 'Triceps Pushdown - Rope Attachment'],
    ]);
  });
});

describe('findAnimations', () => {
  it('finds our own animations by the words of their name', () => {
    expect(findAnimations('hollow hold')).toEqual([
      { id: 'hollow-hold', name: 'hollow body hold (barchetta)', source: 'gym' },
    ]);
    expect(findAnimations('barchetta').map((a) => a.id)).toEqual(['hollow-hold']);
    expect(findAnimations('plank braccia tese').map((a) => a.id)).toEqual(['straight-arm-plank']);
    expect(findAnimations('leg press').map((a) => a.id)).toEqual(['horizontal-leg-press']);
    expect(findAnimations('dumbbell squat')).toEqual([]);
  });
});

describe('currentWeek', () => {
  it('counts weeks from the start date', () => {
    expect(currentWeek('2026-10-23', new Date('2026-10-23T08:00'), 7)).toBe(1);
    expect(currentWeek('2026-10-23', new Date('2026-10-29T20:00'), 7)).toBe(1);
    expect(currentWeek('2026-10-23', new Date('2026-10-30T08:00'), 7)).toBe(2);
  });

  it('stays within the plan', () => {
    expect(currentWeek('2026-10-23', new Date('2027-03-01T08:00'), 7)).toBe(7);
    expect(currentWeek(undefined, new Date('2026-10-23T08:00'), 7)).toBe(1);
  });
});

describe('kgFromPlan', () => {
  it('takes the first number of a load in kg', () => {
    expect(kgFromPlan('8/10 kg')).toBe(8);
    expect(kgFromPlan('45kg')).toBe(45);
    expect(kgFromPlan('2,5 kg')).toBe(2.5);
  });

  it('ignores loads that are not in kg', () => {
    expect(kgFromPlan('trova 12 rm')).toBeUndefined();
    expect(kgFromPlan('troviamo resistenza')).toBeUndefined();
    expect(kgFromPlan(undefined)).toBeUndefined();
  });
});

describe('planProblems', () => {
  const valid = (): Plan => ({
    title: 'Scheda',
    startDate: '2026-09-27',
    weekCount: 2,
    days: [
      {
        id: 'A',
        title: 'Giorno A',
        exercises: [
          {
            id: 'squat',
            name: 'squat',
            media: { search: 'squat', gif: [{ id: 'HsvHqgf', name: 'dumbbell squat' }] },
            weeks: [{ setsReps: '3x10', rest: "1'30", load: '8 kg' }, {}],
          },
        ],
      },
    ],
  });

  it('finds nothing wrong in a plan the app can follow', () => {
    expect(planProblems(valid())).toEqual({ errors: [], warnings: [] });
  });

  it('accepts rounds against the clock', () => {
    const plan = valid();
    plan.days[0].exercises[0].weeks[0] = { setsReps: '5 rep ogni 30" x 4 min' };
    expect(planProblems(plan).warnings).toEqual([]);
  });

  it('rejects repeated ids and more weeks than the plan has', () => {
    const plan = valid();
    plan.days.push({ ...plan.days[0] });
    plan.days[0].exercises[0].weeks.push({}, {});
    const { errors } = planProblems(plan);
    expect(errors).toContain('Il giorno "A" compare più volte.');
    expect(errors).toContain('L\'esercizio "squat" compare più volte: gli id degli esercizi devono essere unici.');
    expect(errors).toContain('"squat" ha 4 settimane, la scheda 2.');
  });

  it('warns about prescriptions the app reads only as notes, and exercises without demonstrations', () => {
    const plan = valid();
    plan.days[0].exercises[0].weeks[0] = { setsReps: 'tre serie lente', rest: 'poco' };
    delete plan.days[0].exercises[0].media;
    expect(planProblems(plan).warnings).toEqual([
      '"squat", settimana 1: "tre serie lente" non indica serie e ripetizioni (es. 3x10, 3x8/10, 3x30", 2xmax, 5 rep ogni 30" x 4 min): l\'app la mostra come nota e non conta le serie.',
      '"squat", settimana 1: il recupero "poco" non si legge (es. 1\'30, 2\', 40"): niente timer.',
      '"squat" non ha GIF né foto: l\'app mostrerà solo la ricerca su YouTube.',
    ]);
  });
});

describe('stepDetails', () => {
  it('lists rest, tempo, reps in reserve and notes, in this order', () => {
    const [step] = session(
      {
        ...plan,
        days: [
          {
            id: 'B',
            title: 'Giorno B',
            exercises: [
              {
                id: 'pecfly',
                name: 'pecfly',
                notes: 'gomiti morbidi',
                weeks: [{ setsReps: '3x10', rest: "1'30", tut: '2" fase eccentrica', rir: '2' }],
              },
            ],
          },
        ],
      },
      'B',
      1,
    );
    expect(stepDetails(step)).toEqual(["recupero 1'30", 'TUT 2" fase eccentrica', 'RIR 2', 'gomiti morbidi']);
  });

  it('is empty when the week says only sets and reps', () => {
    expect(stepDetails(session(plan, 'A', 2)[1])).toEqual([]);
  });
});
