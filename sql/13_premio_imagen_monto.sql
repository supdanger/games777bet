-- =========================================================
-- La imagen y el monto ganado, dentro del cuadro de premio, pasan
-- a tener posición propia e independiente entre sí (antes la
-- imagen se estiraba para llenar todo el cuadro y el monto quedaba
-- siempre centrado). El cuadro (x/y/ancho/alto/blur/oscurecer) no
-- cambia — esto se suma encima.
-- =========================================================

alter table premios_visuales
  add column if not exists imagen_x      numeric(6,2) not null default 50,
  add column if not exists imagen_y      numeric(6,2) not null default 50,
  add column if not exists imagen_tamano numeric(6,2) not null default 60,
  add column if not exists monto_x       numeric(6,2) not null default 50,
  add column if not exists monto_y       numeric(6,2) not null default 50;
