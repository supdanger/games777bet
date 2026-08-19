-- =========================================================
-- Tamaño del ícono dentro de su celda, independiente del tamaño de
-- la celda misma. Hasta ahora era un 60% fijo escrito en el código
-- — no hacía falta más con 3 columnas, pero con 5 (o más adelante,
-- otros motores) las celdas son más angostas y conviene poder
-- ajustarlo por juego.
-- =========================================================

alter table juegos
  add column if not exists grilla_icono_tamano numeric(5,2) not null default 60;
