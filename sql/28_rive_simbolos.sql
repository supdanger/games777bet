-- =========================================================
-- Símbolos animados con Rive: opcional, por símbolo.
--
-- riv_url            — el archivo .riv (el ícono ya diseñado adentro,
--                       importado del mismo PNG que ya usás en el
--                       símbolo, con el movimiento agregado en Rive).
-- riv_trigger_chico   — nombre del disparador en Rive para cuando ese
--                       símbolo forma parte de un premio de dos o
--                       tres iguales.
-- riv_trigger_grande  — nombre del disparador para el premio mayor.
--
-- Sin riv_url, el símbolo se sigue mostrando como imagen normal en
-- todo momento — esto es 100% opcional, no cambia nada de lo que ya
-- funciona si no lo usás.
-- =========================================================

alter table simbolos
  add column if not exists riv_url text,
  add column if not exists riv_trigger_chico text,
  add column if not exists riv_trigger_grande text;

-- Para que el reintento de un giro (mismo client_id) devuelva
-- exactamente las mismas columnas ganadoras que la vez original, no
-- solo el monto y el saldo.
alter table rondas_jugadas
  add column if not exists simbolos_ganadores jsonb not null default '[]';
