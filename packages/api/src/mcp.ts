// The MCP server: tools to write a user's training plans with an assistant such as Claude.
// Stateless: each request builds a server for the signed-in user and answers in JSON.

import type { StoredPlan } from '@gymapp/log';
import { planProblems, type Plan } from '@gymapp/plan';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import type { Store } from './index.ts';
import type { MediaSearch } from './media.ts';

const note = (max: number) => z.string().max(max).optional();

const prescription = z
  .object({
    load: note(100).describe(
      'Load, e.g. "8 kg", "8/10 kg", "elastico rosso", or "trova 12 rm" to find the 12-rep max.',
    ),
    setsReps: note(200).describe(
      'Sets x reps: "3x10", "3x8/10" (rep range), "3/4x10" (set range), "3x30\\"" (seconds), "2xmax". ' +
        'A hold done after each set, as in a superset: "3x20/30\\"+20\\" a lato side plank" (per side, timed). ' +
        'Rounds against the clock: "5 rep ogni 30\\" x 4 min". Write each week in full, not "uguale 5min". ' +
        'Text after it stays as a note. "limitati a questo" goes with a "trova N rm" load.',
    ),
    rest: note(20).describe('Rest between sets: "1\'30", "2\'", "40\\"". The app runs a timer.'),
    tut: note(50).describe('Time under tension, e.g. "3-1-1".'),
    rir: note(50).describe('Reps in reserve.'),
  })
  .describe('One week of an exercise. An empty field keeps the previous week’s value.');

const exercise = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9-]{1,80}$/)
    .describe('Unique in the plan, lowercase with dashes (e.g. "squat-con-manubrio"). Logged sets refer to it.'),
  name: z.string().min(1).max(200).describe('As the trainer writes it.'),
  videoToSend: note(200).describe('When to send the trainer a video of the execution, e.g. "ultima serie".'),
  notes: note(1000).describe('Execution notes.'),
  compensation: note(500).describe('Compensations to avoid.'),
  media: z
    .object({
      gif: z
        .array(
          z.union([
            z.object({ id: z.string().regex(/^\w{7}$/), name: z.string().max(200) }),
            z.object({
              id: z.string().regex(/^[a-z0-9-]{1,40}$/),
              name: z.string().max(200),
              source: z.literal('gym'),
              credit: note(200).describe('Author and licence, as find_exercise_media gives them: keep them.'),
            }),
          ]),
        )
        .max(4)
        .optional()
        .describe(
          'GIFs from find_exercise_media, one per part of a superset, in order: ExerciseDB ones, or our own ' +
            'animations, which keep `source: "gym"`.',
        ),
      photos: z
        .array(z.string().max(200))
        .max(4)
        .optional()
        .describe('free-exercise-db ids from find_exercise_media, used when GIFs are missing.'),
      search: note(200).describe('Text to search YouTube for a video.'),
    })
    .optional(),
  weeks: z.array(prescription).max(52).describe('One entry per week, from week 1.'),
});

const plan = z.object({
  title: z.string().min(1).max(200),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe('Date the trainer wrote the plan, YYYY-MM-DD. Weeks count from the first workout, not from here.'),
  weekCount: z.number().int().min(1).max(52),
  days: z
    .array(
      z.object({
        id: z
          .string()
          .regex(/^\w{1,8}$/)
          .describe('Short id, e.g. "A".'),
        title: z.string().min(1).max(200),
        exercises: z.array(exercise).min(1).max(40).describe('In the order they are done.'),
      }),
    )
    .min(1)
    .max(14),
});

type PlanInput = z.infer<typeof plan>;

const json = (value: unknown, isError = false) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  ...(isError && { isError: true }),
});

const isActive = (plans: StoredPlan[]) => {
  const active = plans.filter((p) => p.activeSince).sort((a, b) => b.activeSince!.localeCompare(a.activeSince!))[0];
  return (p: StoredPlan) => p.id === active?.id;
};

function buildServer(store: Store, search: MediaSearch) {
  const server = new McpServer(
    { name: 'gym', version: '1.0.0' },
    {
      instructions:
        'Training plans for the gym workout app. A plan has days, each with exercises in order, and one ' +
        'prescription per week. To turn a trainer’s spreadsheet into a plan: read it, call find_exercise_media ' +
        'for each exercise (English names work best) and put the chosen GIF and photo ids in `media`, then ' +
        'call create_plan and fix what it reports. Texts the user sees are in Italian, as the trainer wrote them.',
    },
  );

  server.registerTool(
    'list_plans',
    { description: 'The user’s plans, oldest first, with which one is active.', inputSchema: {} },
    async () => {
      const { plans } = await store.download();
      const active = isActive(plans);
      return json(
        plans
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .map((p) => ({
            id: p.id,
            title: p.plan.title,
            createdAt: p.createdAt,
            active: active(p),
            weekCount: p.plan.weekCount,
            days: p.plan.days.map((d) => ({ id: d.id, title: d.title, exercises: d.exercises.length })),
            excel: p.excel,
          })),
      );
    },
  );

  server.registerTool(
    'get_plan',
    {
      description: 'A whole plan: the active one, or the one with the given id.',
      inputSchema: { plan_id: z.string().optional() },
    },
    async ({ plan_id }: { plan_id?: string }) => {
      const { plans } = await store.download();
      const found = plan_id ? plans.find((p) => p.id === plan_id) : plans.find(isActive(plans));
      if (!found) return json({ error: plan_id ? 'No plan with this id.' : 'There is no active plan.' }, true);
      return json({ id: found.id, active: isActive(plans)(found), excel: found.excel, plan: found.plan });
    },
  );

  server.registerTool(
    'create_plan',
    {
      description:
        'Saves a new plan. It becomes the active one unless `activate` is false. Errors keep it from being ' +
        'saved; warnings say what the app will show only as notes.',
      inputSchema: { plan, activate: z.boolean().default(true) },
    },
    async ({ plan: content, activate }: { plan: PlanInput; activate: boolean }) => {
      const problems = planProblems(content as Plan);
      if (problems.errors.length) return json(problems, true);
      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      await store.createPlan({
        id,
        createdAt: now,
        ...(activate && { activeSince: now }),
        excel: false,
        plan: content,
      });
      return json({ id, active: activate, warnings: problems.warnings });
    },
  );

  server.registerTool(
    'update_plan',
    {
      description:
        'Replaces the content of a plan, e.g. to fix a prescription. Keep exercise ids unchanged: logged sets ' +
        'refer to them.',
      inputSchema: { plan_id: z.string(), plan },
    },
    async ({ plan_id, plan: content }: { plan_id: string; plan: PlanInput }) => {
      const problems = planProblems(content as Plan);
      if (problems.errors.length) return json(problems, true);
      const data = await store.download();
      if (!data.plans.some((p) => p.id === plan_id)) return json({ error: 'No plan with this id.' }, true);

      const kept = new Set(content.days.flatMap((d) => d.exercises.map((e) => e.id)));
      const workouts = new Set(data.workouts.filter((w) => w.planId === plan_id).map((w) => w.id));
      const lost = [...new Set(data.sets.filter((s) => workouts.has(s.workoutId)).map((s) => s.exerciseId))].filter(
        (id) => !kept.has(id),
      );
      await store.updatePlan(plan_id, content);
      return json({
        id: plan_id,
        warnings: [
          ...lost.map(
            (id) => `"${id}" non è più nella scheda, ma ha serie registrate: nello storico resterà senza prescrizione.`,
          ),
          ...problems.warnings,
        ],
      });
    },
  );

  server.registerTool(
    'activate_plan',
    { description: 'Makes a plan the active one.', inputSchema: { plan_id: z.string() } },
    async ({ plan_id }: { plan_id: string }) =>
      (await store.activatePlan(plan_id, new Date().toISOString()))
        ? json({ id: plan_id, active: true })
        : json({ error: 'No plan with this id.' }, true),
  );

  server.registerTool(
    'find_exercise_media',
    {
      description:
        'Searches demonstrations for an exercise: animated GIFs (our own animations first, then ExerciseDB) ' +
        'and start/end photos (free-exercise-db). Use English names, e.g. "dumbbell squat", "cable seated row"; try shorter ' +
        'queries when nothing comes back. Put the chosen ids in the exercise’s `media`.',
      inputSchema: { query: z.string().min(2).max(100), limit: z.number().int().min(1).max(20).default(8) },
    },
    async ({ query, limit }: { query: string; limit: number }) => json(await search(query, limit)),
  );

  server.registerTool(
    'excel_upload_link',
    {
      description:
        'A link, valid for two hours, to upload the trainer’s original Excel file for a plan; the app shows it ' +
        'next to the plan. It needs a shell that can send the file (e.g. curl).',
      inputSchema: { plan_id: z.string() },
    },
    async ({ plan_id }: { plan_id: string }) => {
      const url = await store.planUploadLink(plan_id);
      if (!url) return json({ error: 'No plan with this id.' }, true);
      return json({
        url,
        how: `curl -X PUT -H "Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" --data-binary @<file.xlsx> "${url}"`,
      });
    },
  );

  return server;
}

export async function handleMcp(request: Request, store: Store, search: MediaSearch): Promise<Response> {
  const server = buildServer(store, search);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}
