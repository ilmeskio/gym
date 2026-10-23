-- Gli utenti anonimi (la demo senza account) hanno i propri dati come tutti,
-- ma il file Excel della scheda resta a chi ha fatto login con l'email.
drop policy "schede leggibili da chi ha fatto login" on storage.objects;

create policy "schede leggibili da chi ha fatto login con l'email" on storage.objects
  for select to authenticated
  using (bucket_id = 'schede' and not coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false));
