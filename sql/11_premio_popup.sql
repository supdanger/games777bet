-- =========================================================
-- Cuadro de premio: aparece solo cuando ganás, mostrando el monto.
-- Usa una imagen de fondo opcional (elegida por vos) con el mismo
-- sistema de posición/tamaño/blur que las otras capas — pero no
-- participa del orden de capas, porque siempre tiene que quedar
-- arriba de todo para que se lea el número.
-- =========================================================

alter table juegos
  add column if not exists premio_url       text,
  add column if not exists premio_x         numeric(6,2) not null default 50,
  add column if not exists premio_y         numeric(6,2) not null default 50,
  add column if not exists premio_ancho     numeric(6,2) not null default 60,
  add column if not exists premio_alto      numeric(6,2) not null default 30,
  add column if not exists premio_blur      numeric(5,2) not null default 0,
  add column if not exists premio_oscurecer numeric(5,2) not null default 0;
