-- Portable schema: the chosen videos are a JSON object stored as plain text, as SQLite would keep it.

alter table public.preferences alter column videos drop default;
alter table public.preferences alter column videos type text using videos::text;
alter table public.preferences alter column videos set default '{}';
