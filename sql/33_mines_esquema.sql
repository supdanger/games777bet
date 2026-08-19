-- =========================================================
-- MINES — esquema.
--
-- Diferencia de fondo con los slots: una tirada de tragamonedas es
-- una sola pregunta al servidor. Una partida de Mines dura varios
-- pasos (destapar, destapar, retirar) y el servidor tiene que
-- ACORDARSE de dónde están las minas entre un paso y el siguiente,
-- sin decírselo al navegador hasta que la partida termina. Por eso
-- hace falta una tabla de partidas, no solo un cálculo de una vez.
-- =========================================================

-- Config por juego: el margen de la casa (equivalente al RTP de un
-- slot, pero acá es un solo número en vez de calibrar símbolos) va
-- configurable por juego, igual que ya son la apuesta mín/máx.
alter table juegos
  add column if not exists mines_margen_pct numeric(5,4) not null default 0.0300
    check (mines_margen_pct >= 0 and mines_margen_pct < 1);

-- Imágenes de las tres caras de una casilla — opcional, sin cargar
-- ninguna se ve con un estilo por defecto (no bloquea probar la
-- mecánica antes de tener arte).
alter table juegos
  add column if not exists mines_casilla_oculta_url  text,
  add column if not exists mines_casilla_segura_url  text,
  add column if not exists mines_casilla_mina_url    text;

create table if not exists mines_rondas (
  id         uuid primary key default gen_random_uuid(),
  juego_id   uuid not null references juegos(id) on delete cascade,

  -- Identifica al jugador dentro del token de Win777, igual que
  -- client_id en rondas_jugadas — no es una cuenta propia de acá.
  jugador_id text not null,

  apuesta    numeric(12,2) not null check (apuesta > 0),
  minas      int not null check (minas >= 1 and minas <= 24),

  -- Las posiciones de las minas viven acá, pero NUNCA se devuelven
  -- al cliente en ninguna respuesta mientras estado='en_curso' — eso
  -- es tan importante como que el servidor calcule el resultado en
  -- los slots. Se puede leer recién cuando la partida ya terminó.
  posiciones_mina jsonb not null,
  reveladas       jsonb not null default '[]',

  estado     text not null default 'en_curso'
             check (estado in ('en_curso', 'retirada', 'perdida')),
  multiplicador_actual numeric(12,4) not null default 1,
  ganancia_final        numeric(12,2),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mines_rondas_juego on mines_rondas (juego_id, jugador_id);
-- Como mucho una partida en_curso por jugador y juego a la vez — así
-- no puede abrir una segunda ronda mientras la primera sigue viva.
create unique index if not exists idx_mines_rondas_una_en_curso
  on mines_rondas (juego_id, jugador_id)
  where estado = 'en_curso';

alter table mines_rondas enable row level security;

-- Mismo criterio que rondas_jugadas: el navegador nunca escribe acá
-- directo, solo el servidor (Service Role Key). Con sesión del
-- ensamblador se puede LEER, para un futuro historial — nunca
-- insertar, modificar ni borrar.
drop policy if exists "con sesion, leer" on mines_rondas;
create policy "con sesion, leer" on mines_rondas for select
  using (auth.uid() is not null);
