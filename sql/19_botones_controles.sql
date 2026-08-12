-- =========================================================
-- Los controles dejan de estar clavados en la barra de abajo: cada
-- grupo (saldo, apuesta, velocidad) tiene su posición propia, igual
-- que el botón de girar.
--
-- Los botones chicos (−, +, x1, x2, x3) pasan a poder tener imagen
-- propia, con el MISMO criterio que el de girar: el tamaño del
-- botón y el de la imagen se controlan por separado, para poder
-- calzar la imagen adentro sin deformarla.
-- =========================================================

alter table juegos
  add column if not exists saldo_x    numeric(6,2) not null default 14,
  add column if not exists saldo_y    numeric(6,2) not null default 96,
  add column if not exists apuesta_x  numeric(6,2) not null default 50,
  add column if not exists apuesta_y  numeric(6,2) not null default 96,
  add column if not exists turbo_x    numeric(6,2) not null default 86,
  add column if not exists turbo_y    numeric(6,2) not null default 96;

-- Una fila por botón. Sin fila = botón con su aspecto por defecto
-- (el texto), que es como está hoy: no hace falta configurar nada
-- para que siga funcionando igual.
create table if not exists botones (
  id             uuid primary key default gen_random_uuid(),
  juego_id       uuid not null references juegos(id) on delete cascade,
  clave          text not null check (clave in ('menos', 'mas', 'x1', 'x2', 'x3')),
  imagen_url     text,
  tamano         numeric(6,2) not null default 28,
  imagen_tamano  numeric(6,2) not null default 70,
  sin_fondo      boolean      not null default false,
  created_at     timestamptz  not null default now(),
  unique (juego_id, clave)
);

alter table botones enable row level security;

drop policy if exists "con sesion, todo" on botones;
create policy "con sesion, todo" on botones for all
  using (auth.uid() is not null) with check (auth.uid() is not null);
