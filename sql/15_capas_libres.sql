-- =========================================================
-- Imágenes libres: a diferencia de fondo/marco/cartel (un slot
-- fijo cada uno), acá se pueden agregar tantas como quieras para ir
-- personalizando el juego. Tamaño único (no ancho/alto separado)
-- para no deformar el archivo, igual que la imagen del premio.
-- Se ubican siempre en su propia capa fija (no participan del
-- reordenamiento de fondo/marco/grilla/cartel).
-- =========================================================

create table if not exists capas_libres (
  id          uuid primary key default gen_random_uuid(),
  juego_id    uuid not null references juegos(id) on delete cascade,
  imagen_url  text,
  x           numeric(6,2) not null default 50,
  y           numeric(6,2) not null default 50,
  tamano      numeric(6,2) not null default 40,
  angulo      numeric(6,2) not null default 0,
  blur        numeric(5,2) not null default 0,
  oscurecer   numeric(5,2) not null default 0,
  orden       integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table capas_libres enable row level security;

drop policy if exists "con sesion, todo" on capas_libres;
create policy "con sesion, todo" on capas_libres for all
  using (auth.uid() is not null) with check (auth.uid() is not null);
