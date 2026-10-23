// The app's server API, the same on every runtime: Supabase Edge Functions today,
// Cloudflare Workers tomorrow. The runtime gives it how to recognise the user and
// where each user's rows live; the routes, the checks and the CORS rules stay here.

import type { LoggedSet, Preferences, RepMax, ServerData, StoredPlan, Workout } from '@gymapp/log';
import type { Plan } from '@gymapp/plan';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { verifyWithJwks } from 'hono/jwt';
import { handleMcp } from './mcp.ts';
import { mediaSearch, type MediaSearch } from './media.ts';
import * as check from './validate.ts';

export { mediaSearch } from './media.ts';

export type User = { id: string; anonymous: boolean; token: string };

/** One user's rows: every method acts only on the user the store was made for. */
export type Store = {
  download(): Promise<ServerData>;
  putWorkout(workout: Workout): Promise<void>;
  deleteWorkout(id: string): Promise<void>;
  putSet(set: LoggedSet): Promise<void>;
  deleteSet(id: string): Promise<void>;
  putRepMax(repMax: RepMax): Promise<void>;
  deleteRepMax(exerciseId: string): Promise<void>;
  putPreferences(preferences: Preferences): Promise<void>;
  /** Plans are written only through the MCP. */
  createPlan(plan: StoredPlan): Promise<void>;
  /** False if the user has no plan with this id. */
  updatePlan(id: string, plan: Plan): Promise<boolean>;
  activatePlan(id: string, at: string): Promise<boolean>;
  /** A plan's original Excel file, or nothing if it is missing. */
  planFile(planId: string): Promise<ArrayBuffer | undefined>;
  /** A short-lived link to download a plan's Excel file. */
  planFileLink(planId: string): Promise<string | undefined>;
  /** A short-lived link to upload a plan's Excel file; the plan is marked as having one. */
  planUploadLink(planId: string): Promise<string | undefined>;
};

type Options = {
  verify: (token: string) => Promise<User | undefined>;
  store: (user: User) => Store;
  /** Web pages allowed to call the API. */
  origins: string[];
  mcp: {
    /** The API's public address, as MCP clients reach it. */
    publicUrl: string;
    /** The OAuth server that signs the tokens (Supabase Auth). */
    authorizationServer: string;
    search?: MediaSearch;
  };
};

type JsonWebKey = NonNullable<Parameters<typeof verifyWithJwks>[1]['keys']>[number];

type Env = { Variables: { user: User; store: Store } };

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function createApp({ verify, store, origins, mcp }: Options) {
  const app = new Hono<Env>();
  const search = mcp.search ?? mediaSearch();
  const metadataUrl = `${mcp.publicUrl}/.well-known/oauth-protected-resource`;

  app.use('*', cors({ origin: origins, allowMethods: ['GET', 'PUT', 'DELETE'], maxAge: 86_400 }));

  // How MCP clients find where to sign in (RFC 9728).
  app.get('/.well-known/oauth-protected-resource', (c) =>
    c.json({
      resource: `${mcp.publicUrl}/mcp`,
      authorization_servers: [mcp.authorizationServer],
      bearer_methods_supported: ['header'],
    }),
  );

  app.use('*', async (c, next) => {
    const token = c.req.header('Authorization')?.match(/^Bearer (.+)$/)?.[1];
    const user = token ? await verify(token) : undefined;
    if (!user) {
      c.header('WWW-Authenticate', `Bearer resource_metadata="${metadataUrl}"`);
      return c.json({ error: 'unauthorized' }, 401);
    }
    c.set('user', user);
    c.set('store', store(user));
    await next();
  });

  app.get('/data', async (c) => c.json(await c.var.store.download()));

  /** A PUT whose body must be a valid row with the key named in the path. */
  const put = <T>(
    path: string,
    parse: (b: unknown) => T | undefined,
    key: (row: T) => string,
    save: (s: Store, row: T) => Promise<void>,
  ) =>
    app.put(path, async (c) => {
      const row = parse(await c.req.json().catch(() => undefined));
      if (!row || key(row) !== c.req.param('key')) return c.json({ error: 'invalid row' }, 400);
      await save(c.var.store, row);
      return c.body(null, 204);
    });

  put(
    '/workouts/:key',
    check.workout,
    (w) => w.id,
    (s, w) => s.putWorkout(w),
  );
  put(
    '/sets/:key',
    check.set,
    (x) => x.id,
    (s, x) => s.putSet(x),
  );
  put(
    '/rep-maxes/:key',
    check.repMax,
    (r) => r.exerciseId,
    (s, r) => s.putRepMax(r),
  );

  app.delete('/workouts/:key', async (c) => (await c.var.store.deleteWorkout(c.req.param('key')), c.body(null, 204)));
  app.delete('/sets/:key', async (c) => (await c.var.store.deleteSet(c.req.param('key')), c.body(null, 204)));
  app.delete('/rep-maxes/:key', async (c) => (await c.var.store.deleteRepMax(c.req.param('key')), c.body(null, 204)));

  app.put('/preferences', async (c) => {
    const preferences = check.preferences(await c.req.json().catch(() => undefined));
    if (!preferences) return c.json({ error: 'invalid preferences' }, 400);
    await c.var.store.putPreferences(preferences);
    return c.body(null, 204);
  });

  // Excel files and the MCP are for whoever signed in with an email, not for the demo.
  const notForTheDemo = async (
    c: { var: Env['Variables']; json: (b: unknown, s: 403) => Response },
    next: () => Promise<void>,
  ) => {
    if (c.var.user.anonymous) return c.json({ error: 'not for the demo' }, 403);
    await next();
  };
  app.use('/plans/*', notForTheDemo);
  app.use('/mcp', notForTheDemo);

  app.get('/plans/:id/file', async (c) => {
    const file = await c.var.store.planFile(c.req.param('id'));
    return file ? c.body(file, 200, { 'Content-Type': XLSX }) : c.json({ error: 'missing' }, 404);
  });
  app.get('/plans/:id/file/link', async (c) => {
    const url = await c.var.store.planFileLink(c.req.param('id'));
    return url ? c.json({ url }) : c.json({ error: 'missing' }, 404);
  });

  app.all('/mcp', (c) => handleMcp(c.req.raw, c.var.store, search));

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: 'server error' }, 500);
  });

  return app;
}

/**
 * Recognises the user from a Supabase Auth token: signed by one of the project's
 * published keys (JWKS), for the `authenticated` audience, issued by the project.
 */
export function jwtVerifier({ issuer, keys }: { issuer: string; keys: () => Promise<JsonWebKey[]> }) {
  return async (token: string): Promise<User | undefined> => {
    try {
      const claims = await verifyWithJwks(token, {
        keys: await keys(),
        allowedAlgorithms: ['ES256', 'RS256'],
        verification: { iss: issuer, aud: 'authenticated' },
      });
      if (typeof claims.sub !== 'string') return;
      return { id: claims.sub, anonymous: claims.is_anonymous === true, token };
    } catch {
      return;
    }
  };
}

/** The project's published keys, fetched once and kept for ten minutes. */
export function jwksFrom(url: string) {
  let cached: { keys: JsonWebKey[]; until: number } | undefined;
  return async () => {
    if (!cached || cached.until < Date.now()) {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`JWKS ${response.status}`);
      const { keys } = (await response.json()) as { keys: JsonWebKey[] };
      cached = { keys, until: Date.now() + 600_000 };
    }
    return cached.keys;
  };
}
