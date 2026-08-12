-- =========================================================
-- Modo "figura": la cadena arma su PROPIA forma, sin depender del
-- marco ni de acomodar cada foco a mano.
--
-- Hasta ahora había dos modos: 'marco' (los focos siguen el borde del
-- marco del juego) y 'libre' (cada foco arrastrado uno por uno).
-- Falta el caso más común: querer un rectángulo de luces en algún
-- lugar de la pantalla, con su tamaño y su inclinación.
--
--   figura 'rectangulo' — los focos recorren el perímetro
--   figura 'circulo'    — los focos se reparten en una elipse
--   figura 'linea'      — los focos en fila recta
--
-- La rotación gira la figura entera sobre su centro, así una línea
-- puede quedar vertical o en diagonal sin tocar cada foco.
-- =========================================================

alter table cadenas_luces
  drop constraint if exists cadenas_luces_modo_check;

alter table cadenas_luces
  add constraint cadenas_luces_modo_check
  check (modo in ('marco', 'libre', 'figura'));

alter table cadenas_luces
  add column if not exists figura text not null default 'rectangulo'
    check (figura in ('rectangulo', 'circulo', 'linea')),
  add column if not exists figura_x        numeric(6,2) not null default 50,
  add column if not exists figura_y        numeric(6,2) not null default 50,
  add column if not exists figura_ancho    numeric(6,2) not null default 60,
  add column if not exists figura_alto     numeric(6,2) not null default 30,
  add column if not exists figura_rotacion numeric(6,2) not null default 0;
