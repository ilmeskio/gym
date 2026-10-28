import {
  activePlan,
  doneInWeek,
  firstOpenWeek,
  lastTime,
  nextDay,
  setsOf,
  workoutInProgress,
  type StoredPlan,
  type Workout,
} from '@gymapp/log';
import { currentWeek, session, todayDate, type Plan } from '@gymapp/plan';
import exampleData from '@gymapp/plan/data/example.json';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { pendingAuthorization } from './src/data/authorization';
import { DataProvider, useData } from './src/data/Data';
import { supabase } from './src/data/supabase';
import { shortDate } from './src/format';
import { Consent } from './src/screens/Consent';
import { ExcelFile } from './src/screens/ExcelFile';
import { Exercise } from './src/screens/Exercise';
import { Finish } from './src/screens/Finish';
import { FullPlan } from './src/screens/FullPlan';
import { History } from './src/screens/History';
import { Home } from './src/screens/Home';
import { NoPlan } from './src/screens/NoPlan';
import { PastWorkout } from './src/screens/PastWorkout';
import { Preview } from './src/screens/Preview';
import { SignIn } from './src/screens/SignIn';
import { WorkoutDetail } from './src/screens/WorkoutDetail';
import { keepAwake } from './src/signal';
import { colors } from './src/theme';
import { loadNewVersion, useNewVersion } from './src/useNewVersion';

/** The demo's plan, built into the app; its id is fixed so demo workouts can refer to it. */
const EXAMPLE: StoredPlan = {
  id: '00000000-0000-4000-8000-000000000001',
  createdAt: '2026-10-01T00:00:00Z',
  activeSince: '2026-10-01T00:00:00Z',
  excel: false,
  plan: exampleData as Plan,
};

type Screen =
  | { name: 'home' }
  | { name: 'preview'; dayId: string }
  | { name: 'workout'; id: string }
  | { name: 'history' }
  | { name: 'pastWorkout' }
  | { name: 'detail'; id: string }
  | { name: 'fullPlan' }
  | { name: 'excel' };

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.app}>
        <StatusBar style="light" />
        <DataProvider>
          <Content />
        </DataProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Content() {
  const data = useData();
  const { state } = data;
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [chosenWeek, setChosenWeek] = useState<number>();
  const [authorization, setAuthorization] = useState(pendingAuthorization);
  const demo = !!data.session?.user.is_anonymous;
  const current = demo ? EXAMPLE : activePlan(state);
  const plan = current?.plan;
  const planOf = (w: Workout): Plan | undefined =>
    (w.planId && (w.planId === EXAMPLE.id ? EXAMPLE : state.plans[w.planId])?.plan) || plan;
  const startDate = current && state.preferences.planStarts[current.id];
  const inProgress = workoutInProgress(state);
  const newVersion = useNewVersion();
  // The week of the workout in progress; otherwise the calendar's, or the next one once every day of a week is done.
  const week =
    chosenWeek ??
    inProgress?.week ??
    (plan && current
      ? Math.max(
          currentWeek(startDate, new Date(), plan.weekCount),
          firstOpenWeek(state, current.id, plan.days.map((d) => d.id), plan.weekCount),
        )
      : 1);
  const goHome = () => setScreen({ name: 'home' });

  const workout = screen.name === 'workout' ? state.workouts[screen.id] : undefined;
  const workoutPlan = workout && planOf(workout);
  const steps = useMemo(
    () => (workout && workoutPlan ? session(workoutPlan, workout.dayId, workout.week) : []),
    [workout?.dayId, workout?.week, workoutPlan],
  );

  // The screen stays on for the whole workout, between one set and the next.
  const training = screen.name === 'workout';
  useEffect(() => {
    if (!training) return;
    keepAwake(true);
    return () => keepAwake(false);
  }, [training]);

  if (!data.loaded || data.session === undefined) return null;

  // Claude (or another MCP client) asked to connect: sign in with an email, then consent.
  if (authorization) {
    if (!data.session || demo) return <SignIn forClaude />;
    return <Consent authorizationId={authorization} onDone={() => setAuthorization(undefined)} />;
  }

  if (!data.session) return <SignIn />;
  if (!current || !plan) return <NoPlan onSignOut={() => supabase.auth.signOut()} />;

  const days = plan.days.map((d) => d.id);
  const titleOf = (p: Plan, dayId: string) => p.days.find((d) => d.id === dayId)?.title ?? dayId;
  const setStart = (date: string) => data.setStartDate(current.id, date);

  switch (screen.name) {
    case 'preview':
      return (
        <Preview
          title={titleOf(plan, screen.dayId)}
          week={week}
          steps={session(plan, screen.dayId, week)}
          inProgressWarning={!!inProgress}
          lastSets={(exerciseId) => lastTime(state, '', exerciseId)?.sets}
          onBack={goHome}
          onStart={() => {
            if (!startDate) setStart(todayDate());
            const id = data.startWorkout(current.id, screen.dayId, week);
            setScreen({ name: 'workout', id });
          }}
        />
      );

    case 'workout': {
      if (!workout || !workoutPlan) return null;
      const index = workout.currentExercise;
      const heading =
        `${titleOf(workoutPlan, workout.dayId)} · settimana ${workout.week}` +
        (workout.loggedLater ? ` · ${shortDate(workout.startedAt)}` : '');
      if (index >= steps.length) {
        const sets = setsOf(state, workout.id);
        const exercises = new Set(sets.map((s) => s.exerciseId)).size;
        return (
          <Finish
            heading={heading}
            summary={`${exercises} esercizi su ${steps.length} · ${sets.length} serie registrate`}
            onBack={() => data.moveToExercise(workout.id, steps.length - 1)}
            onClose={(feedback) => {
              data.finishWorkout(workout.id, feedback);
              setChosenWeek(undefined);
              setScreen({ name: 'detail', id: workout.id });
            }}
          />
        );
      }
      return (
        <Exercise
          key={`${workout.id}-${index}`}
          step={steps[index]}
          workoutId={workout.id}
          heading={heading}
          noRest={!!workout.loggedLater}
          onNext={() => data.moveToExercise(workout.id, index + 1)}
          onPrevious={index > 0 ? () => data.moveToExercise(workout.id, index - 1) : undefined}
          onExit={goHome}
        />
      );
    }

    case 'history':
      return (
        <History
          planOf={planOf}
          state={state}
          onOpen={(w) => setScreen({ name: 'detail', id: w.id })}
          onAdd={() => setScreen({ name: 'pastWorkout' })}
          onBack={goHome}
        />
      );

    case 'pastWorkout':
      return (
        <PastWorkout
          plan={plan}
          startDate={startDate}
          suggestedDay={nextDay(state, current.id, days)}
          onBack={() => setScreen({ name: 'history' })}
          onConfirm={(past) => {
            // A workout logged before the plan's start moves the start to that day.
            if (!startDate || past.date < startDate) setStart(past.date);
            const id = data.startWorkout(current.id, past.dayId, past.week, {
              at: new Date(`${past.date}T${past.time}`).toISOString(),
              durationMin: past.durationMin,
            });
            setChosenWeek(undefined);
            setScreen({ name: 'workout', id });
          }}
        />
      );

    case 'detail': {
      const done = state.workouts[screen.id];
      const donePlan = done && planOf(done);
      if (!done || !donePlan) return null;
      return (
        <WorkoutDetail
          plan={donePlan}
          state={state}
          workout={done}
          onBack={() => setScreen({ name: 'history' })}
          onDelete={() => {
            data.removeWorkout(done.id);
            setScreen({ name: 'history' });
          }}
        />
      );
    }

    case 'fullPlan':
      return (
        <FullPlan
          plan={plan}
          onExcelFile={!demo && current.excel ? () => setScreen({ name: 'excel' }) : undefined}
          onBack={goHome}
        />
      );

    case 'excel':
      return <ExcelFile planId={current.id} onBack={() => setScreen({ name: 'fullPlan' })} />;

    case 'home':
      return (
        <Home
          plan={plan}
          week={week}
          done={doneInWeek(state, current.id, week)}
          startDate={startDate}
          next={nextDay(state, current.id, days)}
          inProgress={inProgress}
          sync={data.sync}
          demo={demo}
          onUpdate={newVersion ? loadNewVersion : undefined}
          onWeek={setChosenWeek}
          onRestart={() => {
            setStart(todayDate());
            setChosenWeek(undefined);
          }}
          onChoose={(dayId) => setScreen({ name: 'preview', dayId })}
          onResume={() => inProgress && setScreen({ name: 'workout', id: inProgress.id })}
          onCancel={() => inProgress && data.removeWorkout(inProgress.id)}
          onHistory={() => setScreen({ name: 'history' })}
          onFullPlan={() => setScreen({ name: 'fullPlan' })}
          onSignOut={() => supabase.auth.signOut()}
        />
      );
  }
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.background },
});
