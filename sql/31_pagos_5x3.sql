-- =========================================================
-- Pagos para el motor de 5 rodillos. El 3x3 se queda exactamente
-- como está — estas columnas quedan en NULL para esos juegos y el
-- editor no las muestra ahí, así que no hay nada que migrar ni
-- riesgo de romper el motor que ya está calibrado y en producción.
--
-- Regla del 5x3, igual criterio que el 3x3 (estándar de slots, de
-- izquierda a derecha, wild sustituye): paga la cadena de símbolos
-- iguales más larga que arranca en el primer rodillo. Dos iguales ya
-- existía (pago_dos/pago_tres); esto agrega cuatro y cinco.
-- =========================================================

alter table simbolos
  add column if not exists pago_cuatro numeric(10,2) check (pago_cuatro >= 0),
  add column if not exists pago_cinco  numeric(10,2) check (pago_cinco >= 0);
