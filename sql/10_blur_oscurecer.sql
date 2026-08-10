-- =========================================================
-- Nitidez (blur) y oscurecimiento, por capa. Se suman a los
-- controles de posición que ya existen — mismo patrón: número
-- guardado, aplicado como filtro CSS al renderizar.
-- =========================================================

alter table juegos
  add column if not exists fondo_pantalla_blur      numeric(5,2) not null default 0,
  add column if not exists fondo_pantalla_oscurecer  numeric(5,2) not null default 0,
  add column if not exists marco_blur                numeric(5,2) not null default 0,
  add column if not exists marco_oscurecer            numeric(5,2) not null default 0,
  add column if not exists cartel_blur                numeric(5,2) not null default 0,
  add column if not exists cartel_oscurecer           numeric(5,2) not null default 0,
  add column if not exists fondo_blur                 numeric(5,2) not null default 0,
  add column if not exists fondo_oscurecer            numeric(5,2) not null default 0;
