-- POATUBE: rode este arquivo inteiro no SQL Editor do Supabase.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Canal' check (char_length(name) between 1 and 40),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, left(coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), split_part(new.email, '@', 1)), 40));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  description text not null default '' check (char_length(description) <= 2000),
  category text not null default 'Outros',
  duration int not null default 0,
  video_path text not null,
  thumb_path text,
  allow_download boolean not null default false,
  views bigint not null default 0,
  created_at timestamptz not null default now()
);
create table public.likes (
  video_id uuid references public.videos(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  primary key (video_id, user_id)
);
create table public.subs (
  channel_id uuid references public.profiles(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  primary key (channel_id, user_id),
  check (channel_id <> user_id)
);
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 500),
  created_at timestamptz not null default now()
);
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  video_id uuid references public.videos(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  reason text check (char_length(reason) <= 500),
  created_at timestamptz not null default now()
);

create function public.increment_views(vid uuid) returns void
language sql security definer set search_path = public as $$
  update public.videos set views = views + 1 where id = vid
$$;
grant execute on function public.increment_views(uuid) to anon, authenticated;

-- Permissões e regras de acesso (RLS)
grant select on all tables in schema public to anon, authenticated;
grant insert, delete on public.videos, public.likes, public.subs, public.comments to authenticated;
grant insert on public.reports to authenticated;
revoke update on public.profiles from anon, authenticated;
grant update (name) on public.profiles to authenticated;

alter table public.profiles enable row level security;
alter table public.videos   enable row level security;
alter table public.likes    enable row level security;
alter table public.subs     enable row level security;
alter table public.comments enable row level security;
alter table public.reports  enable row level security;

create policy "perfis: leitura"        on public.profiles for select using (true);
create policy "perfis: editar o meu"   on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "videos: leitura"        on public.videos for select using (true);
create policy "videos: publicar"       on public.videos for insert to authenticated with check (user_id = auth.uid());
create policy "videos: apagar"         on public.videos for delete to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "curtidas: leitura"      on public.likes for select using (true);
create policy "curtidas: curtir"       on public.likes for insert to authenticated with check (user_id = auth.uid());
create policy "curtidas: descurtir"    on public.likes for delete to authenticated using (user_id = auth.uid());
create policy "inscricoes: leitura"    on public.subs for select using (true);
create policy "inscricoes: inscrever"  on public.subs for insert to authenticated with check (user_id = auth.uid());
create policy "inscricoes: cancelar"   on public.subs for delete to authenticated using (user_id = auth.uid());
create policy "comentarios: leitura"   on public.comments for select using (true);
create policy "comentarios: comentar"  on public.comments for insert to authenticated with check (user_id = auth.uid());
create policy "comentarios: apagar"    on public.comments for delete to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "denuncias: enviar"      on public.reports for insert to authenticated with check (user_id = auth.uid());
create policy "denuncias: so admin le" on public.reports for select to authenticated using (public.is_admin());

-- Armazenamento dos vídeos (bucket público, limite de 50 MB por arquivo)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', true, 52428800,
  array['video/mp4','video/webm','video/ogg','video/quicktime','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "videos: enviar na propria pasta" on storage.objects for insert to authenticated
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "videos: apagar na propria pasta" on storage.objects for delete to authenticated
  using (bucket_id = 'videos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
