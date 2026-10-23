import type { LoggedSet, Workout } from '@gymapp/log';
import { sign } from 'hono/jwt';
import { describe, expect, it } from 'vitest';
import { jwtVerifier } from './index.ts';
import { setup } from './testing.ts';

const workout: Workout = {
  id: 'w1',
  planId: 'p1',
  dayId: 'A',
  week: 1,
  startedAt: '2026-10-23T18:00:00Z',
  currentExercise: 0,
};
const set: LoggedSet = {
  id: 's1',
  workoutId: 'w1',
  exerciseId: 'squat',
  number: 1,
  kg: 10,
  reps: 12,
  loggedAt: '2026-10-23T18:05:00Z',
};

describe('authentication', () => {
  it('rejects requests without a valid token', async () => {
    const { app, call } = setup();
    expect((await app.request('/data')).status).toBe(401);
    expect((await call('GET', '/data', undefined, 'forged')).status).toBe(401);
  });
});

describe('log rows', () => {
  it('stores rows in the signed-in user’s store and gives them back', async () => {
    const { call, storeOf } = setup();
    expect((await call('PUT', '/workouts/w1', workout)).status).toBe(204);
    expect((await call('PUT', '/sets/s1', set)).status).toBe(204);
    expect(
      (await call('PUT', '/rep-maxes/squat', { exerciseId: 'squat', reps: 12, kg: 10, foundAt: set.loggedAt })).status,
    ).toBe(204);
    expect(
      (await call('PUT', '/preferences', { planStarts: { p1: '2026-10-22' }, videos: { squat: 'abc' } })).status,
    ).toBe(204);

    const data = await (await call('GET', '/data')).json();
    expect(data.workouts).toEqual([workout]);
    expect(data.sets).toEqual([set]);
    expect(data.repMaxes).toHaveLength(1);
    expect(data.preferences).toEqual({ planStarts: { p1: '2026-10-22' }, videos: { squat: 'abc' } });
    expect(data.plans).toEqual([]);
    expect(storeOf('demo').data.workouts.size).toBe(0);
  });

  it('deletes rows', async () => {
    const { call, storeOf } = setup();
    await call('PUT', '/sets/s1', set);
    expect((await call('DELETE', '/sets/s1')).status).toBe(204);
    expect(storeOf('anna').data.sets.size).toBe(0);
  });

  it('rejects a body that is malformed or names another row than the path', async () => {
    const { call } = setup();
    expect((await call('PUT', '/workouts/w1', { ...workout, week: 'one' })).status).toBe(400);
    expect((await call('PUT', '/workouts/w2', workout)).status).toBe(400);
    expect((await call('PUT', '/sets/s1', { ...set, kg: -1 })).status).toBe(400);
    expect((await call('PUT', '/preferences', { planStarts: {}, videos: { squat: 3 } })).status).toBe(400);
    expect((await call('PUT', '/preferences', { planStarts: { p1: 'ieri' }, videos: {} })).status).toBe(400);
  });

  it('keeps only the known fields of a row', async () => {
    const { call, storeOf } = setup();
    await call('PUT', '/workouts/w1', { ...workout, userId: 'someone-else' });
    expect(storeOf('anna').data.workouts.get('w1')).toEqual(workout);
  });
});

describe('plan file', () => {
  it('is for users signed in with an email, not for the demo', async () => {
    const { call, storeOf } = setup();
    storeOf('anna').data.files.set('p1', 'xlsx');
    const file = await call('GET', '/plans/p1/file');
    expect(file.status).toBe(200);
    expect(await file.text()).toBe('xlsx');
    expect(await (await call('GET', '/plans/p1/file/link')).json()).toEqual({
      url: 'https://files.example/p1.xlsx?signed',
    });
    expect((await call('GET', '/plans/p2/file')).status).toBe(404);
    expect((await call('GET', '/plans/p1/file', undefined, 'token-demo')).status).toBe(403);
    expect((await call('GET', '/plans/p1/file/link', undefined, 'token-demo')).status).toBe(403);
  });
});

describe('CORS', () => {
  it('answers the preflight of the allowed origins only', async () => {
    const { app } = setup();
    const preflight = (origin: string) =>
      app.request('/data', {
        method: 'OPTIONS',
        headers: { Origin: origin, 'Access-Control-Request-Method': 'GET' },
      });
    expect((await preflight('https://consiglio.fyi')).headers.get('Access-Control-Allow-Origin')).toBe(
      'https://consiglio.fyi',
    );
    expect((await preflight('https://evil.example')).headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});

describe('jwtVerifier', () => {
  const issuer = 'https://project.supabase.co/auth/v1';

  async function keyPair() {
    const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
      'sign',
      'verify',
    ])) as CryptoKeyPair;
    const publicJwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid: 'k1', alg: 'ES256' };
    const privateJwk = { ...(await crypto.subtle.exportKey('jwk', pair.privateKey)), kid: 'k1', alg: 'ES256' };
    return { publicJwk, privateJwk };
  }

  const claims = (over: Record<string, unknown> = {}) => ({
    sub: 'anna',
    aud: 'authenticated',
    iss: issuer,
    is_anonymous: false,
    exp: Math.floor(Date.now() / 1000) + 600,
    ...over,
  });

  it('accepts a Supabase token signed by a published key', async () => {
    const { publicJwk, privateJwk } = await keyPair();
    const verify = jwtVerifier({ issuer, keys: async () => [publicJwk] });
    const token = await sign(claims({ is_anonymous: true }), privateJwk, 'ES256');
    expect(await verify(token)).toEqual({ id: 'anna', anonymous: true, token });
  });

  it('refuses tokens that are expired, for another audience or signed by another key', async () => {
    const { publicJwk, privateJwk } = await keyPair();
    const other = await keyPair();
    const verify = jwtVerifier({ issuer, keys: async () => [publicJwk] });
    expect(await verify(await sign(claims({ exp: 1 }), privateJwk, 'ES256'))).toBeUndefined();
    expect(await verify(await sign(claims({ aud: 'anon' }), privateJwk, 'ES256'))).toBeUndefined();
    expect(await verify(await sign(claims(), other.privateJwk, 'ES256'))).toBeUndefined();
  });
});
