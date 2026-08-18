-- =========================================================
-- Historial de rondas y RTP real por juego.
--
-- Las rondas ya se venían guardando en rondas_jugadas, pero la tabla
-- tiene RLS sin políticas: solo la Service Role Key del servidor la
-- podía tocar. Eso está bien para escribir (el navegador no debe
-- poder inventar rondas), pero impedía mirarlas desde el
-- ensamblador.
--
-- Se agrega SOLO permiso de lectura, y solo con sesión iniciada. El
-- navegador sigue sin poder insertar, modificar ni borrar rondas: el
-- historial es un registro, no algo editable.
-- =========================================================

drop policy if exists "con sesion, leer" on rondas_jugadas;
create policy "con sesion, leer" on rondas_jugadas for select
  using (auth.uid() is not null);

-- Resumen por juego. Se hace en la base y no en el navegador porque
-- con miles de rondas traerlas todas para sumarlas sería absurdo:
-- acá vuelve una sola fila por juego.
--
-- El RTP real es lo pagado sobre lo apostado. Converge al teórico con
-- el tiempo; con pocos giros no significa nada, por eso también se
-- devuelve la cantidad de rondas para poder decir cuándo mirarlo en
-- serio.
create or replace function resumen_juego(p_juego_id uuid)
returns table (
  rondas        bigint,
  apostado      numeric,
  pagado        numeric,
  rtp_real      numeric,
  premio_mayor  numeric,
  ganadas       bigint,
  ultima        timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    count(*)                                              as rondas,
    coalesce(sum(apuesta), 0)                             as apostado,
    coalesce(sum(premio), 0)                              as pagado,
    case when coalesce(sum(apuesta), 0) > 0
         then round(sum(premio) / sum(apuesta) * 100, 2)
         else null end                                    as rtp_real,
    coalesce(max(premio), 0)                              as premio_mayor,
    count(*) filter (where premio > 0)                    as ganadas,
    max(created_at)                                       as ultima
  from rondas_jugadas
  where juego_id = p_juego_id;
$$;
