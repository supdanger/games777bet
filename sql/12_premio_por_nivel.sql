-- =========================================================
-- El cuadro de premio pasa a tener una imagen y posición POR
-- NIVEL (dos iguales / tres iguales / premio mayor), igual que ya
-- funciona con los sonidos. Reemplaza las columnas premio_* de
-- juegos que habíamos agregado recién — no llegaste a cargar
-- ninguna, así que no se pierde nada al migrar.
-- =========================================================

alter table juegos
  drop column if exists premio_url,
  drop column if exists premio_x,
  drop column if exists premio_y,
  drop column if exists premio_ancho,
  drop column if exists premio_alto,
  drop column if exists premio_blur,
  drop column if exists premio_oscurecer;

create table if not exists premios_visuales (
  id          uuid primary key default gen_random_uuid(),
  juego_id    uuid not null references juegos(id) on delete cascade,
  nivel_premio text not null check (nivel_premio in ('dos_iguales', 'tres_iguales', 'premio_mayor')),

  imagen_url  text,
  x           numeric(6,2) not null default 50,
  y           numeric(6,2) not null default 50,
  ancho       numeric(6,2) not null default 60,
  alto        numeric(6,2) not null default 30,
  blur        numeric(5,2) not null default 0,
  oscurecer   numeric(5,2) not null default 0,

  created_at  timestamptz not null default now(),
  unique (juego_id, nivel_premio)
);

alter table premios_visuales enable row level security;

drop policy if exists "con sesion, todo" on premios_visuales;
create policy "con sesion, todo" on premios_visuales for all
  using (auth.uid() is not null) with check (auth.uid() is not null);
