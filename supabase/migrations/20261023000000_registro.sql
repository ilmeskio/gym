-- Registro degli allenamenti. Ogni riga appartiene a un utente e solo lui la vede:
-- la Row Level Security lega lettura e scrittura a auth.uid().
-- Gli id sono generati sul dispositivo, così le righe create offline si inviano più volte senza duplicarsi.

create table public.allenamenti (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  giorno_id text not null,
  settimana smallint not null,
  iniziato_il timestamptz not null,
  concluso_il timestamptz,
  esercizio_corrente smallint not null default 0,
  fatica smallint check (fatica between 1 and 5),
  nota text
);

create table public.serie (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  allenamento_id uuid not null references public.allenamenti on delete cascade,
  esercizio_id text not null,
  numero smallint not null,
  carico text not null default '',
  ripetizioni smallint not null,
  registrata_il timestamptz not null
);

create index serie_allenamento_id on public.serie (allenamento_id);

create table public.rm (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  esercizio_id text not null,
  ripetizioni smallint not null,
  carico text not null,
  allenamento_id uuid references public.allenamenti on delete set null,
  trovato_il timestamptz not null,
  primary key (user_id, esercizio_id)
);

create table public.preferenze (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  inizio date,
  video jsonb not null default '{}'
);

alter table public.allenamenti enable row level security;
alter table public.serie enable row level security;
alter table public.rm enable row level security;
alter table public.preferenze enable row level security;

create policy "i propri allenamenti" on public.allenamenti
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "le proprie serie" on public.serie
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "i propri rm" on public.rm
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "le proprie preferenze" on public.preferenze
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Il file Excel della scheda, leggibile da chi ha fatto login.
-- Le iscrizioni si chiudono dopo il primo accesso, quindi gli utenti autenticati sono solo il proprietario.
insert into storage.buckets (id, name, public) values ('schede', 'schede', false);

create policy "schede leggibili da chi ha fatto login" on storage.objects
  for select to authenticated using (bucket_id = 'schede');
