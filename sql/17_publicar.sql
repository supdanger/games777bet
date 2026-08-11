-- =========================================================
-- Publicación explícita: que un juego esté "listo" (calibrado) no
-- significa que ya tenga que aparecer en el catálogo que consume
-- Win777. "publicado" es un paso aparte, deliberado, para publicar
-- cuando vos decidas — no automático.
--
-- version sube cada vez que tocás "Publicar" — así Win777 detecta
-- que hay algo nuevo para traer la próxima vez que sincronice
-- catálogo (si no cambia el número, Win777 lo deja como "sin
-- cambios" y no reimporta nada).
-- =========================================================

alter table juegos
  add column if not exists publicado boolean not null default false,
  add column if not exists version   integer not null default 1;
