-- =========================================================
-- Mostrar (o no) el nombre del juego arriba de la pantalla.
--
-- Cuando el cartel ya trae el nombre dibujado, la línea de texto de
-- arriba repite la misma información y encima come espacio útil de
-- la pantalla. Pero no todos los juegos van a tener cartel, y ahí el
-- nombre es lo único que identifica dónde está parado el jugador —
-- por eso es una opción por juego y no algo borrado del código.
--
-- Arranca en true para no cambiarle el aspecto a los juegos que ya
-- existen. Al duplicar un juego la opción se copia, así que se
-- desactiva una vez y la heredan todas las copias.
-- =========================================================

alter table juegos
  add column if not exists mostrar_nombre boolean not null default true;
