// The API on Supabase Edge Functions, served at /functions/v1/api.

import { Hono } from 'hono';
import { createApp, jwksFrom, jwtVerifier } from '../../../packages/api/src/index.ts';
import { supabaseStore } from '../../../packages/api/src/supabase.ts';

const url = Deno.env.get('SUPABASE_URL')!;
// The public key is enough: each query runs with the user's own token.
const key = Deno.env.get('SUPABASE_ANON_KEY') ?? JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}').default;

const api = createApp({
  verify: jwtVerifier({ issuer: `${url}/auth/v1`, keys: jwksFrom(`${url}/auth/v1/.well-known/jwks.json`) }),
  store: supabaseStore({ url, key }),
  origins: ['https://consiglio.fyi', 'http://localhost:8081', 'http://localhost:8765'],
  mcp: { publicUrl: `${url}/functions/v1/api`, authorizationServer: `${url}/auth/v1` },
});

Deno.serve(new Hono().route('/api', api).fetch);
