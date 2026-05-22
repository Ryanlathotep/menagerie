
insert into storage.buckets (id, name, public)
values ('bug-screenshots', 'bug-screenshots', true)
on conflict (id) do nothing;

create policy "Anyone can upload bug screenshots"
on storage.objects for insert
with check (bucket_id = 'bug-screenshots');

create policy "Anyone can view bug screenshots"
on storage.objects for select
using (bucket_id = 'bug-screenshots');

create policy "Admins can delete bug screenshots"
on storage.objects for delete
using (bucket_id = 'bug-screenshots' and public.has_role(auth.uid(), 'admin'::public.app_role));
