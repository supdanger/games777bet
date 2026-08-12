-- =========================================================
-- Apariencia de los focos: dejan de ser círculos planos que
-- aparecen y desaparecen, y pasan a verse como lamparitas.
--
--   glow    — el resplandor que desborda del foco (px). Es lo que
--             da la sensación de que ilumina alrededor en vez de ser
--             una calcomanía pegada.
--   nucleo  — cuánto del centro va blanco antes de abrirse al color.
--   apagado — brillo del foco cuando está apagado. En 0 desaparece
--             (como antes); en 15-25% queda opaco, como una lámpara
--             real sin corriente.
--   vidrio  — el reflejo claro arriba a la izquierda.
--
-- Aplica a todas las formas (círculo, cuadrado, rombo, barra): el
-- resplandor sigue el contorno de cada una.
-- =========================================================

alter table cadenas_luces
  add column if not exists glow    numeric(6,2) not null default 14,
  add column if not exists nucleo  numeric(6,2) not null default 45,
  add column if not exists apagado numeric(6,2) not null default 18,
  add column if not exists vidrio  boolean      not null default true;
