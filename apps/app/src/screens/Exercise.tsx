import { lastTime, setsOf } from '@gymapp/log';
import {
  demos,
  holdPhases,
  intervalPhases,
  kgFromPlan,
  repMaxAdvice,
  youtubeId,
  youtubeSearch,
  type Exercise as PlanExercise,
  type SavedTimer,
  type Step,
  type Target,
} from '@gymapp/plan';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Button } from '../components/Button';
import { Countdown, type Progress } from '../components/Countdown';
import { Demo } from '../components/Demo';
import { ExerciseVideo } from '../components/ExerciseVideo';
import { describeSet, SetRow, type Unit } from '../components/SetRow';
import { Stepper } from '../components/Stepper';
import { useData } from '../data/Data';
import { kg as formatKg, shortDate } from '../format';
import { unlockSignals } from '../signal';
import { colors, space } from '../theme';
import { savedTimer, saveTimer } from '../timerStore';
import { useSizes } from '../useSizes';

type Props = {
  step: Step;
  workoutId: string;
  heading: string;
  /** A workout already done, logged later: no rest timer. */
  noRest?: boolean;
  onNext: () => void;
  onPrevious?: () => void;
  onExit: () => void;
};

function describeTarget(t: Target) {
  if (t.kind === 'max') return 'al massimo';
  const values = t.min === t.max ? `${t.min}` : `${t.min}-${t.max}`;
  return t.kind === 'seconds' ? `${values} secondi` : `${values} ripetizioni`;
}

const ADVICE = {
  increase: 'Troppo leggero: aumenta il carico e riprova.',
  decrease: 'Troppo pesante: scendi di carico e riprova.',
  found: 'Trovato!',
};

const ADVICE_MARK = { increase: '↑', decrease: '↓', found: '✓' };

/** ExerciseDB GIFs are 180×180: beyond twice that they get blurry. */
const MAX_MEDIA = 360;

export function Exercise({ step, workoutId, heading, noRest, onNext, onPrevious, onExit }: Props) {
  const { exercise, prescription: p, sets, findRepMax, useRepMax } = step;
  const data = useData();
  const done = setsOf(data.state, workoutId, exercise.id);
  const previous = lastTime(data.state, workoutId, exercise.id);
  const repMax = data.state.repMaxes[exercise.id];
  // A timed hold (preparation, then the seconds), rounds against the clock, or the rest after a set; saved, so a reload resumes it.
  const [timer, setTimer] = useState(() => savedTimer(workoutId, exercise.id));
  function changeTimer(next?: Pick<SavedTimer, 'kind' | 'phases'>) {
    const started = next && { workoutId, exerciseId: exercise.id, ...next, startedAt: Date.now() };
    saveTimer(started);
    setTimer(started);
  }

  const totalSets = findRepMax ? undefined : sets.sets?.max;
  const unit: Unit = sets.target?.kind === 'seconds' ? 'seconds' : 'reps';
  const repMaxFound = findRepMax !== undefined && repMax?.workoutId === workoutId && repMax.reps === findRepMax;
  const finished = findRepMax ? repMaxFound : totalSets === undefined || done.length >= totalSets;
  // Without a prescribed number of sets, sets are logged freely and you move on whenever you like.
  const toLog = findRepMax ? !repMaxFound : totalSets === undefined || done.length < totalSets;
  const last = done.at(-1);

  // Values proposed for the next set: what was done so far, then last time, then the plan.
  const proposedKg =
    last?.kg ?? previous?.sets.at(-1)?.kg ?? (useRepMax && repMax ? repMax.kg : (kgFromPlan(p.load) ?? 0));
  const proposedReps = findRepMax ?? (sets.target && sets.target.kind !== 'max' ? sets.target.max : (last?.reps ?? 10));
  const [chosenKg, setChosenKg] = useState<number>();
  const [chosenReps, setChosenReps] = useState<number>();
  const currentKg = chosenKg ?? proposedKg;
  const currentReps = chosenReps ?? proposedReps;
  // In a superset, the seconds of the hold that follows each set.
  const [chosenThen, setChosenThen] = useState<number>();
  const currentThen = chosenThen ?? sets.then?.seconds;

  const saveRepMax = (kg: number) =>
    findRepMax && data.saveRepMax({ exerciseId: exercise.id, reps: findRepMax, kg, workoutId });

  function logSet(reps = currentReps) {
    unlockSignals();
    const next = { kg: currentKg, reps };
    data.logSet({ workoutId, exerciseId: exercise.id, ...next });
    setChosenReps(undefined);
    const found = findRepMax !== undefined && repMaxAdvice(findRepMax, next.reps) === 'found';
    if (found) saveRepMax(next.kg);
    const more = findRepMax ? !found : totalSets !== undefined && done.length + 1 < totalSets;
    if (more && step.restSeconds && !noRest)
      changeTimer({ kind: 'rest', phases: [{ kind: 'rest', seconds: step.restSeconds }] });
    else changeTimer();
  }

  function startHold() {
    unlockSignals();
    changeTimer({ kind: 'hold', phases: holdPhases(sets, currentReps, currentThen) });
  }

  /** A hold stopped or finished: the seconds done become the set. */
  function endHold({ worked }: Progress) {
    if (worked > 0) logSet(worked);
    else changeTimer();
  }

  function startRounds() {
    unlockSignals();
    if (sets.intervals) changeTimer({ kind: 'rounds', phases: intervalPhases(sets.intervals) });
  }

  /** Rounds stopped or finished: the reps of the rounds done become one set. */
  function endRounds({ rounds }: Progress) {
    if (rounds > 0 && sets.intervals) logSet(rounds * sets.intervals.reps);
    else changeTimer();
  }

  function undoLast() {
    if (last) data.removeSet(last.id);
    changeTimer();
  }

  let planLoad = p.load;
  if (useRepMax) {
    planLoad = repMax
      ? `${formatKg(repMax.kg)} (il tuo ${useRepMax}RM)`
      : `il tuo ${useRepMax}RM, non ancora registrato`;
  }

  const z = useSizes();
  const setsText =
    sets.sets && sets.target && !findRepMax
      ? `${sets.sets.min === sets.sets.max ? sets.sets.max : `${sets.sets.min}-${sets.sets.max}`} × ${describeTarget(sets.target)}`
      : undefined;
  const instructions = sets.note ?? (!sets.sets ? p.setsReps : undefined);

  // One column as tall as the window: what to do at the top, the actions always at the bottom.
  // Sizes follow the window (useSizes); on a screen too short for everything, the column scrolls.
  return (
    <ScrollView
      contentContainerStyle={[styles.content, { padding: z.space(4), gap: z.space(2.5) }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ gap: z.space(1) }}>
        <View style={styles.bar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Esci"
            onPress={onExit}
            style={[styles.exitButton, { width: z.touch, height: z.touch }]}
          >
            <Text style={[styles.exit, { fontSize: z.font(20) }]}>✕</Text>
          </Pressable>
          <Text style={[styles.heading, { fontSize: z.font(14) }]} numberOfLines={1}>
            {heading}
          </Text>
          {/* Moving between exercises sits up here, so the bottom of the screen is left to the sets. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Esercizio precedente"
            disabled={!onPrevious}
            onPress={onPrevious}
            style={[styles.navButton, { width: z.touch, height: z.touch }, !onPrevious && styles.navDisabled]}
          >
            <Text style={[styles.navText, { fontSize: z.font(24) }]}>‹</Text>
          </Pressable>
          <Text style={[styles.counter, { fontSize: z.font(14) }]}>
            {step.position}/{step.total}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={finished ? 'Esercizio successivo' : 'Salta esercizio'}
            onPress={onNext}
            style={[styles.navButton, { width: z.touch, height: z.touch, marginRight: -space(3) }]}
          >
            <Text style={[styles.navText, { fontSize: z.font(24) }]}>›</Text>
          </Pressable>
        </View>
        <View style={styles.progress}>
          <View style={[styles.progressFill, { width: `${(step.position / step.total) * 100}%` }]} />
        </View>
      </View>

      <Media exercise={exercise} minHeight={z.media} />

      <View style={{ gap: z.space(2) }}>
        <Text style={[styles.name, { fontSize: z.font(24) }]} numberOfLines={2}>
          {exercise.name.trim()}
        </Text>
        {/* The explanation until the first set; then the advice under the sets takes its place. */}
        {findRepMax && !done.length ? (
          <Text style={[styles.value, { fontSize: z.font(15) }]}>
            <Text style={styles.repMaxTitle}>Trova il tuo {findRepMax}RM: </Text>
            il carico più alto con cui fai {findRepMax} ripetizioni pulite, e non una di più. Parti leggero e sali serie
            dopo serie; quel carico sarà il riferimento delle prossime settimane.
          </Text>
        ) : null}
        <View style={[styles.chips, { gap: z.space(2) }]}>
          {setsText ? <Chip value={setsText} highlight /> : null}
          {planLoad && !findRepMax ? <Chip label="Carico" value={planLoad} /> : null}
          {p.rest ? <Chip label="Recupero" value={p.rest} /> : null}
          {p.tut ? <Chip label="Esecuzione" value={p.tut} /> : null}
          {p.rir ? <Chip label="RIR" value={p.rir} /> : null}
        </View>
        {instructions ? <Line label="Indicazioni" value={instructions} /> : null}
        {exercise.notes ? <Line label="Note" value={exercise.notes} /> : null}
        {exercise.videoToSend ? <Line label="Video al trainer" value={exercise.videoToSend} warning /> : null}
        {previous ? (
          <Line
            label={`Ultima volta, ${shortDate(previous.workout.startedAt)}`}
            value={previous.sets.map((s) => describeSet(s, unit)).join(' · ')}
          />
        ) : null}
      </View>

      {done.length || totalSets !== undefined ? (
        <View style={[styles.box, { padding: z.space(3), gap: z.space(2) }]}>
          {totalSets !== undefined ? (
            <View style={styles.dots}>
              {Array.from({ length: totalSets }, (_, i) => (
                <View key={i} style={[styles.dot, i < done.length && styles.dotDone]} />
              ))}
            </View>
          ) : null}
          {done.length ? (
            <View style={[styles.chips, { gap: z.space(2) }]}>
              {done.map((s, i) => (
                <SetRow
                  key={s.id}
                  compact
                  set={s}
                  number={i + 1}
                  unit={unit}
                  onSave={(change) => data.editSet(s.id, change)}
                  onDelete={() => data.removeSet(s.id)}
                  mark={
                    findRepMax ? (
                      <Text
                        style={[styles.muted, repMaxAdvice(findRepMax, s.reps) === 'found' && { color: colors.accent }]}
                      >
                        {ADVICE_MARK[repMaxAdvice(findRepMax, s.reps)]}
                      </Text>
                    ) : undefined
                  }
                />
              ))}
              {last ? (
                <Pressable accessibilityRole="button" onPress={undoLast} hitSlop={8}>
                  <Text style={[styles.link, { fontSize: z.font(14) }]}>Annulla l'ultima</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {findRepMax && last ? (
            <Text style={[styles.value, { fontSize: z.font(15) }, repMaxFound && { color: colors.accent }]}>
              {repMaxFound
                ? `${ADVICE.found} Il tuo ${findRepMax}RM è ${formatKg(repMax!.kg)}.`
                : ADVICE[repMaxAdvice(findRepMax, last.reps)]}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.actions, { gap: z.space(3) }]}>
        {timer?.kind === 'hold' ? (
          <Countdown
            key={timer.startedAt}
            phases={timer.phases}
            startedAt={timer.startedAt}
            onDone={endHold}
            stop={{ title: 'Stop', onStop: endHold }}
          />
        ) : timer?.kind === 'rounds' ? (
          <Countdown
            key={timer.startedAt}
            phases={timer.phases}
            startedAt={timer.startedAt}
            onDone={endRounds}
            stop={{ title: 'Stop', onStop: endRounds }}
          />
        ) : timer?.kind === 'rest' ? (
          <Countdown
            key={timer.startedAt}
            phases={timer.phases}
            startedAt={timer.startedAt}
            onDone={() => changeTimer()}
            stop={{ title: 'Salta recupero', onStop: () => changeTimer() }}
          />
        ) : toLog ? (
          <>
            <View style={[styles.fields, { gap: z.space(2) }]}>
              <View style={styles.group}>
                <Text style={[styles.label, { fontSize: z.font(12) }]}>Carico</Text>
                <Stepper label="Carico" unit="kg" zero="corpo libero" value={currentKg} onChange={setChosenKg} />
              </View>
              <View style={styles.group}>
                <Text style={[styles.label, { fontSize: z.font(12) }]}>
                  {unit === 'seconds' ? 'Secondi' : 'Ripetizioni'}
                </Text>
                <Stepper
                  label={unit === 'seconds' ? 'Secondi' : 'Ripetizioni'}
                  value={currentReps}
                  onChange={setChosenReps}
                />
              </View>
              {sets.then && currentThen !== undefined ? (
                <View style={styles.group}>
                  <Text style={[styles.label, { fontSize: z.font(12) }]}>
                    {sets.then.name ?? 'Secondo esercizio'}
                    {sets.then.perSide ? ', per lato' : ''}
                  </Text>
                  <Stepper label="Secondi del secondo esercizio" value={currentThen} onChange={setChosenThen} />
                </View>
              ) : null}
            </View>
            {unit === 'seconds' && !noRest ? (
              <Button title={`Avvia ${currentReps}" (5" per prepararti)`} onPress={startHold} />
            ) : null}
            {sets.intervals && !noRest ? (
              <Button
                title={`Avvia ${sets.intervals.minutes}' a giri da ${sets.intervals.every}" (5" per prepararti)`}
                onPress={startRounds}
              />
            ) : null}
            <Button
              title={
                totalSets ? `Registra serie ${done.length + 1} di ${totalSets}` : `Registra serie ${done.length + 1}`
              }
              variant={(unit === 'seconds' || sets.intervals) && !noRest ? 'outline' : 'solid'}
              onPress={() => logSet()}
            />
            {findRepMax && last ? (
              <Button
                title={`Va bene così: ${formatKg(last.kg)} è il mio ${findRepMax}RM`}
                variant="outline"
                onPress={() => saveRepMax(last.kg)}
              />
            ) : null}
          </>
        ) : null}
        {finished && !timer ? (
          <Button title={step.position === step.total ? 'Fine allenamento' : 'Prossimo esercizio'} onPress={onNext} />
        ) : null}
      </View>
    </ScrollView>
  );
}

/** The chosen video, otherwise an animation from the datasets, otherwise a YouTube search. */
function Media({ exercise, minHeight }: { exercise: PlanExercise; minHeight: number }) {
  const data = useData();
  const z = useSizes();
  // The demonstration takes the room the rest of the screen leaves free, never below minHeight.
  const [area, setArea] = useState(minHeight);
  const chosenVideo = data.state.preferences.videos[exercise.id];
  const setChosenVideo = (youtube: string | undefined) => data.setVideo(exercise.id, youtube);
  const [pasting, setPasting] = useState(false);
  // If a GIF does not load, fall back to the photos, which come from another source.
  const [gifUnavailable, setGifUnavailable] = useState(false);
  const animations = demos(exercise.media, !gifUnavailable);
  const youtube = chosenVideo ?? exercise.media?.youtube;
  const search = () =>
    Linking.openURL(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(youtubeSearch(exercise.name, exercise.media))}`,
    );

  // Side by side (a superset), each demonstration is as tall as its share of the width: square GIFs stay square.
  const { width } = useWindowDimensions();
  const count = youtube ? 1 : Math.max(animations.length, 1);
  const share = (Math.min(width, 640) - 2 * z.space(4) - z.space(2) * (count - 1)) / count;
  const height = Math.min(
    Math.max(area, minHeight) - (count > 1 || animations.some((d) => d.credit) ? 18 : 0),
    MAX_MEDIA,
    count > 1 && animations.every((d) => d.kind === 'gif') ? share : Infinity,
  );

  return (
    <View style={{ flexGrow: 1, gap: z.space(1) }}>
      <View style={[styles.mediaArea, { minHeight }]} onLayout={(e) => setArea(e.nativeEvent.layout.height)}>
        {/* Absolute, so the image follows the area's height and never pushes it. */}
        <View style={styles.mediaFill}>
          {youtube ? (
            <ExerciseVideo youtube={youtube} height={height} />
          ) : animations.length ? (
            <View style={[styles.animations, { gap: z.space(2) }]}>
              {animations.map((d) => (
                <View key={d.name} style={{ flex: 1 }}>
                  <Demo
                    demo={d}
                    height={height}
                    caption={animations.length > 1}
                    onError={() => setGifUnavailable(true)}
                  />
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.noVideo}>
              <Text style={styles.muted}>Nessuna dimostrazione per questo esercizio.</Text>
            </View>
          )}
        </View>
      </View>
      {pasting ? (
        <TextInput
          autoFocus
          placeholder="Incolla qui il link del video YouTube"
          placeholderTextColor={colors.textMuted}
          style={styles.field}
          onChangeText={(link) => {
            const id = youtubeId(link);
            if (id) {
              setChosenVideo(id);
              setPasting(false);
            }
          }}
        />
      ) : null}
      <View style={[styles.mediaActions, { gap: z.space(4) }]}>
        <Pressable accessibilityRole="button" onPress={search} hitSlop={8}>
          <Text style={[styles.link, { fontSize: z.font(13) }]}>Cerca su YouTube</Text>
        </Pressable>
        {chosenVideo ? (
          <Pressable accessibilityRole="button" onPress={() => setChosenVideo(undefined)} hitSlop={8}>
            <Text style={[styles.link, { fontSize: z.font(13) }]}>Togli il video</Text>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => setPasting(!pasting)} hitSlop={8}>
            <Text style={[styles.link, { fontSize: z.font(13) }]}>Usa un video YouTube</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** A short prescription value: sets, load, rest. */
function Chip({ label, value, highlight }: { label?: string; value: string; highlight?: boolean }) {
  const z = useSizes();
  return (
    <View
      style={[
        styles.chip,
        highlight && styles.chipHighlight,
        { paddingHorizontal: z.space(3), paddingVertical: z.space(1) },
      ]}
    >
      <Text style={[styles.chipText, highlight && styles.chipTextHighlight, { fontSize: z.font(highlight ? 18 : 15) }]}>
        {label ? <Text style={styles.muted}>{label} </Text> : null}
        {value}
      </Text>
    </View>
  );
}

/** A longer text on one or two lines, with its label in front. */
function Line({ label, value, warning }: { label: string; value: string; warning?: boolean }) {
  const z = useSizes();
  return (
    <Text style={[styles.value, { fontSize: z.font(15) }, warning && { color: colors.warning }]} numberOfLines={3}>
      <Text style={[styles.label, { fontSize: z.font(12) }]}>{label} </Text>
      {value}
    </Text>
  );
}

const styles = StyleSheet.create({
  // flexGrow: the column fills the window, so the actions can sit at the bottom.
  content: { flexGrow: 1, maxWidth: 640, width: '100%', alignSelf: 'center' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  exitButton: { marginLeft: -space(3), alignItems: 'center', justifyContent: 'center' },
  exit: { color: colors.textMuted },
  heading: { color: colors.textMuted, flex: 1 },
  counter: { color: colors.textMuted, fontVariant: ['tabular-nums'] },
  progress: { height: 4, backgroundColor: colors.surface, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.accent },
  noVideo: { backgroundColor: colors.surface, borderRadius: 12, padding: space(4) },
  mediaArea: { flexGrow: 1 },
  mediaFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'center' },
  animations: { flexDirection: 'row', justifyContent: 'center' },
  mediaActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  link: { color: colors.textMuted, textDecorationLine: 'underline' },
  name: { color: colors.text, fontWeight: '700', textTransform: 'capitalize' },
  repMaxTitle: { color: colors.accent, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  chip: { borderRadius: 8, backgroundColor: colors.surface },
  chipHighlight: { backgroundColor: colors.accentDark },
  chipText: { color: colors.text },
  chipTextHighlight: { color: colors.accent, fontWeight: '700' },
  box: { backgroundColor: colors.surface, borderRadius: 12 },
  label: { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  value: { color: colors.text },
  muted: { color: colors.textMuted },
  fields: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around' },
  field: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: space(3),
    color: colors.text,
    fontSize: 16,
    marginTop: space(1),
  },
  group: { gap: space(1), alignItems: 'center' },
  dots: { flexDirection: 'row', gap: space(2) },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.accent },
  dotDone: { backgroundColor: colors.accent },
  // marginTop auto: on a tall window the actions go to the bottom, near the thumb.
  actions: { marginTop: 'auto' },
  navButton: { alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  navDisabled: { opacity: 0.3 },
  navText: { color: colors.text },
});
