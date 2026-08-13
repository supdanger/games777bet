-- =========================================================
-- Contador ascendente del premio: el monto sube desde cero hasta el
-- total en vez de aparecer de golpe. Es de lo que más se "siente" al
-- ganar, y no cambia nada del resultado — el número final es el
-- mismo que decidió el servidor, solo se muestra progresivamente.
--
-- contador_ms — cuánto dura la subida. En 0 queda como antes
--   (aparece directo), por si en algún juego no lo querés.
--
-- Se sube más rápido en premios chicos y más lento en los grandes:
-- esa parte se calcula sola, no hace falta configurarla por nivel.
-- =========================================================

alter table juegos
  add column if not exists contador_ms integer not null default 900;
