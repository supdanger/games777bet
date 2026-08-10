-- =========================================================
-- gameswin777 — infraestructura de juegos, separada de Win777
--
-- Acá NO vive ningún jugador ni ningún saldo. Eso queda en el
-- Supabase de Win777, siempre. Esta base solo guarda cómo está
-- armado cada juego mientras lo construís: símbolos, pagos,
-- efectos visuales y sonidos.
--
-- Cuando un juego está listo, se publica en el manifiesto y
-- cualquier panel (Win777 u otro operador) lo sincroniza — la
-- integración usa el mismo protocolo de proveedores que ya
-- armamos para Win777.
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- Juegos en desarrollo
-- ---------------------------------------------------------
create table if not exists juegos (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  nombre      text not null,
  descripcion text,

  -- borrador   -> recién arrancado, no se puede probar todavía
  -- en_prueba  -> tiene símbolos y se puede jugar en la vista previa
  -- listo      -> calibrado, puede publicarse en el manifiesto
  estado      text not null default 'borrador'
                check (estado in ('borrador', 'en_prueba', 'listo')),

  motor       text not null default 'clasico-3x3',
  min_bet     numeric(14,2) not null default 1000,
  max_bet     numeric(14,2) not null default 100000,

  -- Fondo del rodillo: una sola imagen para todo el juego,
  -- se repite detrás de las nueve celdas de la grilla.
  fondo_url   text,

  -- Marco/carcasa de la máquina: la imagen fija del diseño.
  marco_url   text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------
-- Símbolos de cada juego
-- ---------------------------------------------------------
create table if not exists simbolos (
  id         uuid primary key default gen_random_uuid(),
  juego_id   uuid not null references juegos(id) on delete cascade,

  nombre     text not null,
  icono_url  text,

  peso       int not null default 5 check (peso > 0),
  pago_tres  numeric(10,2) not null default 0 check (pago_tres >= 0),
  pago_dos   numeric(10,2) not null default 0 check (pago_dos >= 0),

  orden      int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_simbolos_juego on simbolos (juego_id, orden);

-- ---------------------------------------------------------
-- Efectos visuales (CSS) de cada juego
--
-- El código CSS se guarda tal cual se escribió — se valida recién
-- al aplicarlo en el juego, no acá. La posición es en porcentaje,
-- no en píxeles, para que se vea igual en cualquier pantalla.
-- ---------------------------------------------------------
create table if not exists efectos (
  id          uuid primary key default gen_random_uuid(),
  juego_id    uuid not null references juegos(id) on delete cascade,

  nombre      text not null,

  -- carcasa -> decorativo, siempre visible (brillo del marco, luces)
  -- premio  -> dispara solo cuando hay premio
  tipo        text not null default 'carcasa' check (tipo in ('carcasa', 'premio')),

  -- Solo para tipo='premio': qué nivel de premio lo dispara
  nivel_premio text check (nivel_premio in ('dos_iguales', 'tres_iguales', 'premio_mayor')),

  -- Solo para tipo='premio': dónde aparece
  posicion    text default 'linea' check (posicion in ('linea', 'pantalla')),

  css         text not null,

  -- Solo para tipo='carcasa': dónde va sobre la máquina, en %
  pos_x       numeric(5,2),
  pos_y       numeric(5,2),
  tamano      numeric(5,2) default 45,

  duracion_ms int default 900,

  created_at  timestamptz not null default now()
);

create index if not exists idx_efectos_juego on efectos (juego_id, tipo);

-- ---------------------------------------------------------
-- Sonidos de cada juego
-- ---------------------------------------------------------
create table if not exists sonidos (
  id         uuid primary key default gen_random_uuid(),
  juego_id   uuid not null references juegos(id) on delete cascade,

  -- musica_fondo | giro | premio_chico | premio_grande
  tipo       text not null check (tipo in ('musica_fondo', 'giro', 'premio_chico', 'premio_grande')),
  archivo_url text not null,

  created_at timestamptz not null default now(),
  unique (juego_id, tipo)
);

-- Al tocar cualquier pieza de un juego, marcamos cuándo se editó
-- por última vez — útil para ordenar "en qué estabas trabajando".
create or replace function tocar_juego()
returns trigger
language plpgsql
as $$
begin
  update juegos set updated_at = now() where id = coalesce(new.juego_id, old.juego_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_tocar_simbolos on simbolos;
create trigger trg_tocar_simbolos after insert or update or delete on simbolos
  for each row execute function tocar_juego();

drop trigger if exists trg_tocar_efectos on efectos;
create trigger trg_tocar_efectos after insert or update or delete on efectos
  for each row execute function tocar_juego();

drop trigger if exists trg_tocar_sonidos on sonidos;
create trigger trg_tocar_sonidos after insert or update or delete on sonidos
  for each row execute function tocar_juego();
