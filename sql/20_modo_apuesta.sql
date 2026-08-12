-- =========================================================
-- Modo de apuesta, elegible por juego desde el ensamblador:
--
--   fichas     — montos fijos, un toque y listo
--   mas_menos  — solo los botones + y − (de a paso_apuesta)
--   mixto      — fichas para saltar rápido, +/− para ajuste fino
--
-- Los tres comparten el mismo motor: lo único que cambia es qué
-- controles se dibujan. El monto siempre se valida contra min_bet y
-- max_bet en el servidor, así que ningún modo permite apostar fuera
-- de rango por más que se toque el navegador.
--
-- Además, los recuadros de Saldo y Apuesta pueden llevar imagen de
-- fondo propia, con su tamaño, igual que el resto de las capas.
-- =========================================================

alter table juegos
  add column if not exists modo_apuesta text not null default 'mixto'
    check (modo_apuesta in ('fichas', 'mas_menos', 'mixto')),

  -- Los montos de las fichas los define Max por juego. Si queda
  -- vacío, la pantalla arma fichas solas a partir del mínimo
  -- (1x, 2x, 5x, 20x, 50x) para que nunca se vea sin opciones.
  add column if not exists fichas numeric(14,2)[] not null default '{}',

  add column if not exists saldo_fondo_url    text,
  add column if not exists saldo_ancho        numeric(6,2) not null default 110,
  add column if not exists saldo_alto         numeric(6,2) not null default 44,
  add column if not exists apuesta_fondo_url  text,
  add column if not exists apuesta_ancho      numeric(6,2) not null default 110,
  add column if not exists apuesta_alto       numeric(6,2) not null default 44,
  add column if not exists fichas_x           numeric(6,2) not null default 50,
  add column if not exists fichas_y           numeric(6,2) not null default 88;
