-- Allenamenti già fatti e segnati in seguito: la durata indicata, al posto dell'ora di chiusura.
alter table public.allenamenti add column durata_inserita smallint check (durata_inserita > 0);
