-- Il carico delle serie e degli RM diventa un numero in kg (0 = corpo libero) al posto del testo.
-- I valori esistenti prendono il primo numero del testo, come "8/10 kg" -> 8.

alter table public.serie add column kg numeric(6, 2) not null default 0 check (kg >= 0);
update public.serie
  set kg = coalesce(replace(substring(carico from '^\s*(\d+(?:[.,]\d+)?)'), ',', '.')::numeric, 0);
alter table public.serie drop column carico;

alter table public.rm add column kg numeric(6, 2) not null default 0 check (kg >= 0);
update public.rm
  set kg = coalesce(replace(substring(carico from '^\s*(\d+(?:[.,]\d+)?)'), ',', '.')::numeric, 0);
alter table public.rm drop column carico;
