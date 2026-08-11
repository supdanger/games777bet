-- =========================================================
-- Controles del jugador:
--
-- paso_apuesta — de a cuánto sube/baja la apuesta con los botones
--   +/-. Configurable por juego: uno puede ir de a 500 y otro de a
--   1.000 sin tocar código.
--
-- El botón de girar deja de estar clavado abajo a la derecha: pasa a
-- tener posición y tamaño propios, más una imagen opcional con su
-- propio tamaño (en % del botón) para poder calzarla bien. Si la
-- imagen ya ES el botón entero, girar_sin_fondo saca el círculo de
-- atrás y deja solo la imagen.
-- =========================================================

alter table juegos
  add column if not exists paso_apuesta         numeric(14,2) not null default 500,
  add column if not exists girar_x              numeric(6,2)  not null default 50,
  add column if not exists girar_y              numeric(6,2)  not null default 90,
  add column if not exists girar_tamano         numeric(6,2)  not null default 64,
  add column if not exists girar_imagen_url     text,
  add column if not exists girar_imagen_tamano  numeric(6,2)  not null default 70,
  add column if not exists girar_sin_fondo      boolean       not null default false;
