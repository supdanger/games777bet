-- =========================================================
-- Cartel: una tercera capa de imagen, independiente del marco y
-- de la grilla. Pensada como un banner/cartel que puede ir sobre
-- el juego (con el nombre, una promo, lo que sea) — se posiciona
-- y deforma igual que el marco, sin depender de sus proporciones
-- exactas.
-- =========================================================

alter table juegos
  add column if not exists cartel_url   text,
  add column if not exists cartel_x     numeric(6,2) not null default 50,
  add column if not exists cartel_y     numeric(6,2) not null default 15,
  add column if not exists cartel_ancho numeric(6,2) not null default 75,
  add column if not exists cartel_alto  numeric(6,2) not null default 16;
