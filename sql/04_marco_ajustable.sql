-- =========================================================
-- Ajuste fino del marco: posición y tamaño independientes en
-- X e Y, para poder deformar la imagen (estirar/contraer) hasta
-- que calce exacto sobre la grilla, sin depender de que el
-- archivo original tenga las proporciones perfectas.
-- =========================================================

alter table juegos
  add column if not exists marco_x     numeric(6,2) not null default 50,   -- % horizontal, centrado por defecto
  add column if not exists marco_y     numeric(6,2) not null default 50,   -- % vertical, centrado por defecto
  add column if not exists marco_ancho numeric(6,2) not null default 100,  -- % de ancho del contenedor
  add column if not exists marco_alto  numeric(6,2) not null default 100;  -- % de alto del contenedor
