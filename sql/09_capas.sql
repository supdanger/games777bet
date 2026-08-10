-- =========================================================
-- Cuarta capa: fondo de pantalla, separado del marco. El marco
-- es la carcasa de la máquina; esto es un telón libre, ajustable
-- igual que el marco (posición + ancho/alto deformable).
--
-- Además, orden de capas: qué va adelante y qué atrás, para las
-- cuatro imágenes juntas. Antes el orden estaba fijo en el código
-- (fondo, marco, grilla, cartel) — ahora se puede elegir.
-- =========================================================

alter table juegos
  add column if not exists fondo_pantalla_url   text,
  add column if not exists fondo_pantalla_x     numeric(6,2) not null default 50,
  add column if not exists fondo_pantalla_y     numeric(6,2) not null default 50,
  add column if not exists fondo_pantalla_ancho numeric(6,2) not null default 100,
  add column if not exists fondo_pantalla_alto  numeric(6,2) not null default 100;

-- Orden de atrás hacia adelante. El último de la lista queda arriba
-- de todos.
alter table juegos
  add column if not exists capas_orden text[] not null
    default array['fondo_pantalla','marco','grilla','cartel'];
