-- =========================================================
-- Portada: la miniatura de catálogo, distinta del cartel.
--
-- El cartel es una capa DENTRO del juego, posicionada donde
-- quieras mientras jugás. La portada es la carátula que representa
-- al juego en una lista — antes de entrar a jugar. Son conceptos
-- separados, aunque después uses la misma imagen para las dos cosas
-- si te sirve.
-- =========================================================

alter table juegos
  add column if not exists portada_url text;
