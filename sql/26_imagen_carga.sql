-- =========================================================
-- Imagen de la pantalla de carga, propia y separada de la portada.
--
-- La portada es la carátula del catálogo (la que ve el jugador en
-- Win777 antes de entrar). Esta es la que se muestra mientras el
-- juego termina de cargar. Suelen querer ser distintas: la portada
-- es chica y vertical, esta se ve grande y centrada.
--
-- Si queda vacía, la pantalla de carga usa la portada; y si tampoco
-- hay portada, muestra solo el nombre del juego. Nunca queda en
-- blanco.
-- =========================================================

alter table juegos
  add column if not exists carga_url text;
