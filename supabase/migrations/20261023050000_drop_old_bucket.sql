-- The plan file lives in the "plans" bucket: the old "schede" bucket is empty and unused.
-- The bucket itself is deleted from the dashboard (Storage API): SQL cannot delete it.

drop policy "schede leggibili da chi ha fatto login con l'email" on storage.objects;
