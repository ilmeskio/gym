import type { Plan } from '@gymapp/plan';
import { describe, expect, it } from 'vitest';
import { mediaSearch } from './media.ts';
import { AUTH_SERVER, PUBLIC_URL, setup } from './testing.ts';

type Setup = ReturnType<typeof setup>;

/** A JSON-RPC call to the MCP endpoint, as an MCP client sends it. */
async function rpc({ app }: Setup, method: string, params: unknown = {}, token = 'token-anna') {
  return app.request('/mcp', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
}

/** Calls a tool and gives back its JSON answer and whether it is an error. */
async function tool(s: Setup, name: string, args: Record<string, unknown> = {}) {
  const response = await rpc(s, 'tools/call', { name, arguments: args });
  const { result } = (await response.json()) as {
    result: { content: { type: string; text: string }[]; isError?: boolean };
  };
  const text = result.content[0].text;
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { json: json as any, isError: !!result.isError };
}

const plan = (): Plan => ({
  title: 'Scheda di prova',
  startDate: '2026-10-01',
  weekCount: 2,
  days: [
    {
      id: 'A',
      title: 'Giorno A',
      exercises: [
        {
          id: 'squat',
          name: 'squat con manubrio',
          media: { gif: [{ id: 'HsvHqgf', name: 'dumbbell squat' }] },
          weeks: [{ setsReps: '3x10', rest: "1'30", load: '8 kg' }, {}],
        },
        { id: 'plank', name: 'plank', weeks: [{ setsReps: '3x30"' }] },
      ],
    },
  ],
});

describe('MCP authorization', () => {
  it('sends clients without a token to the protected resource metadata', async () => {
    const s = setup();
    const response = await s.app.request('/mcp', { method: 'POST' });
    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toBe(
      `Bearer resource_metadata="${PUBLIC_URL}/.well-known/oauth-protected-resource"`,
    );

    const metadata = await (await s.app.request('/.well-known/oauth-protected-resource')).json();
    expect(metadata).toEqual({
      resource: `${PUBLIC_URL}/mcp`,
      authorization_servers: [AUTH_SERVER],
      bearer_methods_supported: ['header'],
    });
  });

  it('is not for the demo', async () => {
    const s = setup();
    expect((await rpc(s, 'tools/list', {}, 'token-demo')).status).toBe(403);
  });
});

describe('MCP tools', () => {
  it('lists the tools', async () => {
    const s = setup();
    const { result } = await (await rpc(s, 'tools/list')).json();
    expect(result.tools.map((t: { name: string }) => t.name).sort()).toEqual([
      'activate_plan',
      'check_plan',
      'create_plan',
      'excel_upload_link',
      'find_exercise_media',
      'get_plan',
      'list_plans',
      'update_plan',
    ]);
  });

  it('creates a plan, makes it active and reports what the app reads only as notes', async () => {
    const s = setup();
    const created = await tool(s, 'create_plan', { plan: plan() });
    expect(created.isError).toBe(false);
    expect(created.json.warnings).toEqual([
      '"plank", settimana 1: nessun recupero tra le serie, nemmeno nelle settimane prima: l\'app usa 1\'.',
      '"plank" non ha GIF né foto: l\'app mostrerà solo la ricerca su YouTube.',
    ]);

    const stored = s.storeOf('anna').data.plans.get(created.json.id)!;
    expect(stored.plan).toEqual(plan());
    expect(stored.activeSince).toBeDefined();

    const active = await tool(s, 'get_plan');
    expect(active.json.id).toBe(created.json.id);
    expect(active.json.plan.title).toBe('Scheda di prova');
    expect(active.json.warnings).toEqual(created.json.warnings);
    expect(s.storeOf('demo').data.plans.size).toBe(0);
  });

  it('checks a saved plan, the active one or a draft, without saving anything', async () => {
    const s = setup();
    const id = (await tool(s, 'create_plan', { plan: plan() })).json.id;
    const saved = await tool(s, 'check_plan', { plan_id: id });
    expect(saved.isError).toBe(false);
    expect(saved.json).toEqual({
      errors: [],
      warnings: [
        '"plank", settimana 1: nessun recupero tra le serie, nemmeno nelle settimane prima: l\'app usa 1\'.',
        '"plank" non ha GIF né foto: l\'app mostrerà solo la ricerca su YouTube.',
      ],
    });
    expect((await tool(s, 'check_plan')).json).toEqual(saved.json);

    const twice = plan();
    twice.days[0].exercises.push(twice.days[0].exercises[0]);
    const draft = await tool(s, 'check_plan', { plan: twice });
    expect(draft.isError).toBe(false);
    expect(draft.json.errors).toContain('L\'esercizio "squat" compare più volte: gli id degli esercizi devono essere unici.');
    expect(s.storeOf('anna').data.plans.size).toBe(1);

    expect((await tool(s, 'check_plan', { plan_id: 'nessuna' })).isError).toBe(true);
    expect((await tool(s, 'check_plan', { plan_id: id, plan: plan() })).isError).toBe(true);
  });

  it('refuses a plan the app cannot follow, and a malformed one', async () => {
    const s = setup();
    const twice = plan();
    twice.days[0].exercises.push(twice.days[0].exercises[0]);
    const refused = await tool(s, 'create_plan', { plan: twice });
    expect(refused.isError).toBe(true);
    expect(refused.json.errors).toEqual([
      'L\'esercizio "squat" compare più volte: gli id degli esercizi devono essere unici.',
    ]);

    const malformed = await tool(s, 'create_plan', { plan: { ...plan(), weekCount: 'due' } });
    expect(malformed.isError).toBe(true);
    expect(s.storeOf('anna').data.plans.size).toBe(0);
  });

  it('updates a plan and warns when exercises with logged sets disappear', async () => {
    const s = setup();
    const { json } = await tool(s, 'create_plan', { plan: plan() });
    const data = s.storeOf('anna').data;
    data.workouts.set('w1', {
      id: 'w1',
      planId: json.id,
      dayId: 'A',
      week: 1,
      startedAt: '2026-10-02T18:00:00Z',
      currentExercise: 0,
    });
    data.sets.set('s1', {
      id: 's1',
      workoutId: 'w1',
      exerciseId: 'plank',
      number: 1,
      kg: 0,
      reps: 30,
      loggedAt: '2026-10-02T18:05:00Z',
    });
    // The second exercise of a superset is logged under its own id, but it belongs to the squat.
    data.sets.set('s2', {
      id: 's2',
      workoutId: 'w1',
      exerciseId: 'squat~2',
      number: 1,
      kg: 10,
      reps: 12,
      loggedAt: '2026-10-02T18:06:00Z',
    });

    const changed = plan();
    changed.days[0].exercises.pop();
    const updated = await tool(s, 'update_plan', { plan_id: json.id, plan: changed });
    expect(updated.isError).toBe(false);
    expect(updated.json.warnings).toContain(
      '"plank" non è più nella scheda, ma ha serie registrate: nello storico resterà senza prescrizione.',
    );
    expect(updated.json.warnings.join(' ')).not.toContain('squat');
    expect(data.plans.get(json.id)!.plan.days[0].exercises).toHaveLength(1);

    expect((await tool(s, 'update_plan', { plan_id: 'missing', plan: changed })).isError).toBe(true);
  });

  it('lists plans and switches the active one', async () => {
    const s = setup();
    const first = (await tool(s, 'create_plan', { plan: plan() })).json.id;
    const second = (await tool(s, 'create_plan', { plan: { ...plan(), title: 'Bozza' }, activate: false })).json.id;

    let list = (await tool(s, 'list_plans')).json;
    expect(list.map((p: { id: string; active: boolean }) => [p.id, p.active])).toEqual([
      [first, true],
      [second, false],
    ]);

    await tool(s, 'activate_plan', { plan_id: second });
    list = (await tool(s, 'list_plans')).json;
    expect(list.find((p: { active: boolean }) => p.active).id).toBe(second);
  });

  it('finds demonstrations for an exercise', async () => {
    const s = setup(async (query) => ({
      gif: [{ id: 'HsvHqgf', name: `${query} match`, preview: 'https://static.exercisedb.dev/media/HsvHqgf.gif' }],
      photos: [],
    }));
    const { json } = await tool(s, 'find_exercise_media', { query: 'dumbbell squat' });
    expect(json.gif[0]).toEqual({
      id: 'HsvHqgf',
      name: 'dumbbell squat match',
      preview: 'https://static.exercisedb.dev/media/HsvHqgf.gif',
    });
  });

  it('finds our own animations too, and accepts them in a plan', async () => {
    const empty = async (url: string | URL | Request) =>
      Response.json(String(url).includes('exercisedb') ? { data: [] } : []);
    const s = setup(mediaSearch(empty as typeof fetch));
    const { json } = await tool(s, 'find_exercise_media', { query: 'hollow hold' });
    expect(json.gif).toEqual([
      {
        id: 'hollow-hold',
        name: 'hollow body hold (barchetta)',
        source: 'gym',
        preview: 'https://consiglio.fyi/gym/animations/hollow-hold.gif',
      },
    ]);

    const withAnimation = plan();
    withAnimation.days[0].exercises[1].media = {
      gif: [{ id: 'hollow-hold', name: 'barchetta', source: 'gym', credit: 'disegno di Franpol, wger.de, CC BY-SA 4.0' }],
    };
    const created = await tool(s, 'create_plan', { plan: withAnimation });
    expect(created.isError).toBe(false);
    const saved = (await tool(s, 'get_plan', { plan_id: created.json.id })).json.plan;
    expect(saved.days[0].exercises[1].media.gif[0].credit).toBe('disegno di Franpol, wger.de, CC BY-SA 4.0');
  });

  it('gives a link to upload the original Excel file', async () => {
    const s = setup();
    const id = (await tool(s, 'create_plan', { plan: plan() })).json.id;
    const { json } = await tool(s, 'excel_upload_link', { plan_id: id });
    expect(json.url).toBe(`https://files.example/upload/${id}.xlsx?token=t`);
    expect(json.how).toContain('curl -X PUT');
    expect(s.storeOf('anna').data.plans.get(id)!.excel).toBe(true);
  });
});
