-- =========================================================
-- Seguridad: solo vos podés entrar, y solo con sesión podés
-- tocar algo. Es una herramienta de un solo usuario — no hace
-- falta el sistema de permisos de Win777 acá.
-- =========================================================

alter table juegos enable row level security;
alter table simbolos enable row level security;
alter table efectos enable row level security;
alter table sonidos enable row level security;

drop policy if exists "con sesion, todo" on juegos;
create policy "con sesion, todo" on juegos for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "con sesion, todo" on simbolos;
create policy "con sesion, todo" on simbolos for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "con sesion, todo" on efectos;
create policy "con sesion, todo" on efectos for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "con sesion, todo" on sonidos;
create policy "con sesion, todo" on sonidos for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- ---------------------------------------------------------
-- Bucket para íconos, fondos y sonidos
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('assets', 'assets', true)
on conflict (id) do nothing;

drop policy if exists "lectura publica de assets" on storage.objects;
create policy "lectura publica de assets"
  on storage.objects for select
  using (bucket_id = 'assets');

drop policy if exists "con sesion sube assets" on storage.objects;
create policy "con sesion sube assets"
  on storage.objects for insert
  with check (bucket_id = 'assets' and auth.uid() is not null);

drop policy if exists "con sesion actualiza assets" on storage.objects;
create policy "con sesion actualiza assets"
  on storage.objects for update
  using (bucket_id = 'assets' and auth.uid() is not null);

drop policy if exists "con sesion borra assets" on storage.objects;
create policy "con sesion borra assets"
  on storage.objects for delete
  using (bucket_id = 'assets' and auth.uid() is not null);
