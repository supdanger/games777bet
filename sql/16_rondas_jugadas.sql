-- =========================================================
-- Registro de jugadas con dinero real (vía Win777 como proveedor,
-- no la plata de mentira de la Vista previa del editor). No vive
-- ningún saldo acá — el saldo real siempre vive en Win777 — esto es
-- solo para que un giro nunca se resuelva ni se cobre dos veces.
--
-- client_id lo genera el navegador del jugador, una vez por giro, y
-- es EL MISMO roundId que se le manda a Win777 en apostar/premiar.
-- Si el pedido se corta y el navegador reintenta con el mismo
-- client_id, se devuelve el resultado ya guardado acá en vez de
-- resolver una jugada nueva — y aunque este guardado fallara por
-- algún motivo, Win777 también es idempotente por su cuenta con el
-- mismo roundId, así que no se duplica el cobro/pago en ningún caso.
-- =========================================================

create table if not exists rondas_jugadas (
  id             uuid primary key default gen_random_uuid(),
  juego_id       uuid not null references juegos(id) on delete cascade,
  client_id      text not null unique,

  apuesta        numeric(14,2) not null,
  premio         numeric(14,2) not null default 0,
  nivel_premio   text,
  grilla         jsonb not null,
  saldo_despues  numeric(14,2),

  created_at     timestamptz not null default now()
);

create index if not exists idx_rondas_juego on rondas_jugadas (juego_id, created_at desc);

-- RLS activado y SIN políticas a propósito: nadie desde el navegador
-- (ni anónimo ni logueado) puede leer ni escribir acá. Solo la
-- Service Role Key del lado servidor la toca, que bypassea RLS.
alter table rondas_jugadas enable row level security;
