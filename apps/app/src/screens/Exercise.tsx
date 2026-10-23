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
  type Phase,
  type Step,
  type Target,
} from '@gymapp/plan';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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

export function Exercise({ step, workoutId, heading, noRest, onNext, onPrevious, onExit }: Props) {
  const { exercise, prescription: p, sets, findRepMax, useRepMax } = step;
  const data = useData();
  const done = setsOf(data.state, workoutId, exercise.id);
  const previous = lastTime(data.state, workoutId, exercise.id);
  const repMax = data.state.repMaxes[exercise.id];
  // A timed hold (preparation, then the seconds), rounds against the clock, or the rest after a set.
  const [timer, setTimer] = useState<{ kind: 'hold' | 'rounds' | 'rest'; phases: Phase[] }>();

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
      setTimer({ kind: 'rest', phases: [{ kind: 'rest', seconds: step.restSeconds }] });
    else setTimer(undefined);
  }

  function startHold() {
    unlockSignals();
    setTimer({ kind: 'hold', phases: holdPhases(sets, currentReps) });
  }

  /** A hold stopped or finished: the seconds done become the set. */
  function endHold({ worked }: Progress) {
    if (worked > 0) logSet(worked);
    else setTimer(undefined);
  }

  function startRounds() {
    unlockSignals();
    if (sets.intervals) setTimer({ kind: 'rounds', phases: intervalPhases(sets.intervals) });
  }

  /** Rounds stopped or finished: the reps of the rounds done become one set. */
  function endRounds({ rounds }: Progress) {
    if (rounds > 0 && sets.intervals) logSet(rounds * sets.intervals.reps);
    else setTimer(undefined);
  }

  function undoLast() {
    if (last) data.removeSet(last.id);
    setTimer(undefined);
  }

  let planLoad = p.load;
  if (useRepMax) {
    planLoad = repMax
      ? `${formatKg(repMax.kg)} (il tuo ${useRepMax}RM)`
      : `il tuo ${useRepMax}RM, non ancora registrato`;
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.bar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Esci" onPress={onExit} hitSlop={12}>
          <Text style={styles.exit}>✕</Text>
        </Pressable>
        <Text style={styles.heading}>{heading}</Text>
        <Text style={styles.counter}>
          {step.position}/{step.total}
        </Text>
      </View>
      <View style={styles.progress}>
        <View style={[styles.progressFill, { width: `${(step.position / step.total) * 100}%` }]} />
      </View>

      <Media exercise={exercise} />

      <Text style={styles.name}>{exercise.name.trim()}</Text>

      {findRepMax ? (
        <View style={styles.box}>
          <Text style={styles.boxTitle}>Trova il tuo {findRepMax}RM</Text>
          <Text style={styles.value}>
            Il carico più alto con cui riesci a fare {findRepMax} ripetizioni pulite, e non una di più. Parti leggero e
            sali serie dopo serie finché la {findRepMax}ª è l'ultima che riesci a fare. Quel carico sarà il riferimento
            delle prossime settimane.
          </Text>
        </View>
      ) : null}

      <View style={styles.grid}>
        {sets.sets && sets.target && !findRepMax ? (
          <Item
            label="Serie"
            value={`${sets.sets.min === sets.sets.max ? sets.sets.max : `${sets.sets.min}-${sets.sets.max}`} × ${describeTarget(sets.target)}`}
            highlight
          />
        ) : null}
        {sets.note || (!sets.sets && p.setsReps) ? <Item label="Indicazioni" value={sets.note ?? p.setsReps!} /> : null}
        {planLoad && !findRepMax ? <Item label="Carico" value={planLoad} /> : null}
        {p.rest ? <Item label="Recupero" value={p.rest} /> : null}
        {p.tut ? <Item label="Esecuzione" value={p.tut} /> : null}
        {p.rir ? <Item label="RIR" value={p.rir} /> : null}
        {exercise.notes ? <Item label="Note" value={exercise.notes} /> : null}
        {exercise.videoToSend ? (
          <Item label="Video da mandare al trainer" value={exercise.videoToSend} warning />
        ) : null}
        {previous ? (
          <Item
            label={`Ultima volta, ${shortDate(previous.workout.startedAt)}`}
            value={previous.sets.map((s) => describeSet(s, unit)).join(' · ')}
          />
        ) : null}
      </View>

      <View style={styles.box}>
        {done.map((s, i) => (
          <SetRow
            key={s.id}
            set={s}
            number={i + 1}
            unit={unit}
            onSave={(change) => data.editSet(s.id, change)}
            onDelete={() => data.removeSet(s.id)}
            mark={
              findRepMax ? (
                <Text style={[styles.muted, repMaxAdvice(findRepMax, s.reps) === 'found' && { color: colors.accent }]}>
                  {ADVICE_MARK[repMaxAdvice(findRepMax, s.reps)]}
                </Text>
              ) : undefined
            }
          />
        ))}
        {done.length ? <Text style={styles.hint}>Tocca una serie per correggerla.</Text> : null}
        {findRepMax && last ? (
          <Text style={[styles.value, repMaxFound && { color: colors.accent }]}>
            {repMaxFound
              ? `${ADVICE.found} Il tuo ${findRepMax}RM è ${formatKg(repMax!.kg)}.`
              : ADVICE[repMaxAdvice(findRepMax, last.reps)]}
          </Text>
        ) : null}
        {totalSets !== undefined ? (
          <View style={styles.dots}>
            {Array.from({ length: totalSets }, (_, i) => (
              <View key={i} style={[styles.dot, i < done.length && styles.dotDone]} />
            ))}
          </View>
        ) : null}

        {toLog && !timer ? (
          <View style={{ gap: space(3) }}>
            <View style={styles.fields}>
              <View style={styles.group}>
                <Text style={styles.label}>Carico</Text>
                <Stepper label="Carico" unit="kg" zero="corpo libero" value={currentKg} onChange={setChosenKg} />
              </View>
              <View style={styles.group}>
                <Text style={styles.label}>{unit === 'seconds' ? 'Secondi' : 'Ripetizioni'}</Text>
                <Stepper
                  label={unit === 'seconds' ? 'Secondi' : 'Ripetizioni'}
                  value={currentReps}
                  onChange={setChosenReps}
                />
              </View>
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
          </View>
        ) : null}

        {last ? (
          <Pressable accessibilityRole="button" onPress={undoLast}>
            <Text style={styles.link}>Annulla l'ultima serie</Text>
          </Pressable>
        ) : null}
      </View>

      {timer?.kind === 'hold' ? (
        <Countdown phases={timer.phases} onDone={endHold} stop={{ title: 'Stop', onStop: endHold }} />
      ) : timer?.kind === 'rounds' ? (
        <Countdown phases={timer.phases} onDone={endRounds} stop={{ title: 'Stop', onStop: endRounds }} />
      ) : timer?.kind === 'rest' ? (
        <Countdown
          phases={timer.phases}
          onDone={() => setTimer(undefined)}
          stop={{ title: 'Salta recupero', onStop: () => setTimer(undefined) }}
        />
      ) : finished ? (
        <Button title={step.position === step.total ? 'Fine allenamento' : 'Prossimo esercizio'} onPress={onNext} />
      ) : null}

      <View style={styles.navigation}>
        {onPrevious ? <Button title="‹ Precedente" variant="outline" inRow onPress={onPrevious} /> : null}
        {!finished ? <Button title="Salta ›" variant="outline" inRow onPress={onNext} /> : null}
      </View>
    </ScrollView>
  );
}

/** The chosen video, otherwise an animation from the datasets, otherwise a YouTube search. */
function Media({ exercise }: { exercise: PlanExercise }) {
  const data = useData();
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

  return (
    <View style={{ gap: space(2) }}>
      {youtube ? (
        <ExerciseVideo youtube={youtube} />
      ) : animations.length ? (
        <View style={styles.animations}>
          {animations.map((d) => (
            <View key={d.name} style={{ flex: 1 }}>
              <Demo demo={d} onError={() => setGifUnavailable(true)} />
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.noVideo}>
          <Text style={styles.muted}>Nessuna dimostrazione per questo esercizio.</Text>
        </View>
      )}
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
      <View style={styles.mediaActions}>
        <Pressable accessibilityRole="button" onPress={search}>
          <Text style={styles.link}>Cerca su YouTube</Text>
        </Pressable>
        {chosenVideo ? (
          <Pressable accessibilityRole="button" onPress={() => setChosenVideo(undefined)}>
            <Text style={styles.link}>Togli il video</Text>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => setPasting(!pasting)}>
            <Text style={styles.link}>Usa un video YouTube</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function Item({
  label,
  value,
  highlight,
  warning,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  warning?: boolean;
}) {
  return (
    <View style={styles.item}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, highlight && styles.valueLarge, warning && { color: colors.warning }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space(4), gap: space(4), maxWidth: 640, width: '100%', alignSelf: 'center' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  exit: { color: colors.textMuted, fontSize: 20 },
  heading: { color: colors.textMuted, fontSize: 14, flex: 1 },
  counter: { color: colors.textMuted, fontSize: 14, fontVariant: ['tabular-nums'] },
  progress: { height: 4, backgroundColor: colors.surface, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.accent },
  noVideo: { backgroundColor: colors.surface, borderRadius: 12, padding: space(4) },
  animations: { flexDirection: 'row', gap: space(2) },
  mediaActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space(4) },
  link: { color: colors.textMuted, textDecorationLine: 'underline' },
  name: { color: colors.text, fontSize: 26, fontWeight: '700', textTransform: 'capitalize' },
  box: { backgroundColor: colors.surface, borderRadius: 12, padding: space(4), gap: space(3) },
  boxTitle: { color: colors.accent, fontSize: 18, fontWeight: '600' },
  grid: { gap: space(3) },
  item: { gap: space(1) },
  label: { color: colors.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  value: { color: colors.text, fontSize: 17 },
  valueLarge: { fontSize: 22, fontWeight: '600', color: colors.accent },
  muted: { color: colors.textMuted },
  hint: { color: colors.textMuted, fontSize: 13 },
  fields: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: space(3) },
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
  dots: { flexDirection: 'row', gap: space(2), justifyContent: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.accent },
  dotDone: { backgroundColor: colors.accent },
  navigation: { flexDirection: 'row', gap: space(3) },
});
