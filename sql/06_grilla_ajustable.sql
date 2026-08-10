-- =========================================================
-- Posición y tamaño de la grilla, igual de ajustable que el
-- marco. Antes vivía fija en el medio, en el flujo normal del
-- documento — ahora se puede mover y achicar para dejar espacio
-- a otras cosas (una imagen arriba, por ejemplo).
--
-- A diferencia del marco (que se puede deformar a propósito), acá
-- un solo "tamaño" en vez de ancho/alto separados: las celdas
-- tienen que seguir siendo cuadradas, si no los íconos se ven
-- estirados feo.
-- =========================================================

alter table juegos
  add column if not exists grilla_x       numeric(6,2) not null default 50,
  add column if not exists grilla_y       numeric(6,2) not null default 46,
  add column if not exists grilla_tamano  numeric(6,2) not null default 70;
