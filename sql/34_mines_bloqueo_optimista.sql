-- =========================================================
-- Bloqueo optimista para mines_rondas.
--
-- El problema real: revelar y retirar leían la fila y RECIÉN
-- DESPUÉS la escribían, en dos pasos separados. Si llegan dos
-- pedidos casi al mismo tiempo (dos clicks, o alguien probando a
-- propósito "retirar" dos veces en simultáneo), los dos pueden leer
-- "en_curso" antes de que ninguno haya terminado de escribir, y los
-- dos terminan procesando el mismo paso — en el caso del retiro,
-- eso es plata paga de más.
--
-- La solución: cada fila lleva un número de versión. Cada escritura
-- exige que la versión siga siendo la que se leyó, Y de paso la
-- incrementa. Si dos pedidos parten de la misma versión, solo uno
-- de los dos puede ganar la escritura — el otro se entera de que
-- llegó tarde (cero filas afectadas) y no sigue adelante con el
-- pago ni con el resultado.
-- =========================================================

alter table mines_rondas
  add column if not exists version integer not null default 0;
