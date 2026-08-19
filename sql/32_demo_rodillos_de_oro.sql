-- =========================================================
-- Juego de demostración: "Rodillos de Oro"
-- Slot 5x3, motor clasico-5x3, con comodín (wild).
-- RTP calibrado a ~93% — para tener un juego real con el que probar
-- toda la cadena (grilla, motor de rodillos, RTP, animaciones) sin
-- tener que armar símbolos y pagos a mano primero.
--
-- Corré esto DESPUÉS de 01_esquema.sql y 31_pagos_5x3.sql. Es seguro
-- correrlo más de una vez: borra el juego anterior con el mismo slug
-- antes de recrearlo.
--
-- Sin ícono cargado en ningún símbolo a propósito — se ven como
-- texto (el nombre) hasta que subas las imágenes que quieras. La
-- mecánica no depende de eso para funcionar.
--
-- Arranca en "en_prueba", no en "listo": no se sincroniza solo al
-- catálogo de Win777. Promovelo a mano cuando lo hayas probado.
-- =========================================================

delete from juegos where slug = 'rodillos-de-oro';

with nuevo as (
  insert into juegos (slug, nombre, descripcion, estado, motor, min_bet, max_bet)
  values (
    'rodillos-de-oro',
    'Rodillos de Oro',
    '5 rodillos, una línea de pago. Paga la cadena de símbolos iguales más larga que arranca en el primer rodillo, de izquierda a derecha. El comodín sustituye a cualquier símbolo.',
    'en_prueba',
    'clasico-5x3',
    1000,
    50000
  )
  returning id
)
-- Símbolos (RTP ~93.0%, volatilidad media, paga 1 de cada 5.4 giros,
-- premio mayor 1500x). El orden es de más común a más raro.
insert into simbolos (juego_id, nombre, peso, pago_dos, pago_tres, pago_cuatro, pago_cinco, orden)
select id, v.nombre, v.peso, v.dos, v.tres, v.cuatro, v.cinco, v.orden
from nuevo, (values
  ('cereza',    26, 1,  9,  21,  52, 0),
  ('limon',     24, 1,  9,  21,  52, 1),
  ('uva',       20, 1, 10,  30,  70, 2),
  ('campana',   14, 0, 15,  45, 118, 3),
  ('herradura',  9, 0, 24,  76, 200, 4),
  ('diamante',   6, 0, 38, 138, 355, 5),
  ('siete',      3, 0, 76, 275, 750, 6),
  ('wild',       2, 0,  0,   0, 1500, 7)
) as v(nombre, peso, dos, tres, cuatro, cinco, orden);

-- Efectos visuales (CSS). Mismo criterio que "Frutas del 777": uno de
-- carcasa siempre visible, tres de premio según el nivel.
insert into efectos (juego_id, nombre, tipo, nivel_premio, posicion, css, duracion_ms)
select id, e.nombre, e.tipo, e.nivel, e.pos, e.css, e.dur
from juegos j, (values

  ('Brillo del marco', 'carcasa', null, null,
   E'@keyframes brillo-marco-oro {\n  0%,100% { box-shadow: inset 0 0 20px rgba(217,164,65,.15); }\n  50% { box-shadow: inset 0 0 35px rgba(217,164,65,.4); }\n}\n.efecto { position:absolute; inset:0; border-radius:20px; pointer-events:none; animation: brillo-marco-oro 3s ease-in-out infinite; }',
   3000),

  ('Destello chico', 'premio', 'dos_iguales', 'linea',
   E'@keyframes destello-chico-oro {\n  0% { opacity:0; transform:scale(.9); }\n  40% { opacity:.7; transform:scale(1.05); }\n  100% { opacity:0; transform:scale(1); }\n}\n.efecto-premio { background: radial-gradient(ellipse, rgba(107,138,253,.5), transparent 70%); animation: destello-chico-oro 700ms ease-out; }',
   700),

  ('Destello grande', 'premio', 'tres_iguales', 'linea',
   E'@keyframes destello-grande-oro {\n  0% { opacity:0; transform:scale(.8); }\n  30% { opacity:1; transform:scale(1.15); }\n  100% { opacity:0; transform:scale(1); }\n}\n.efecto-premio { background: radial-gradient(ellipse, rgba(91,191,136,.6), transparent 65%); animation: destello-grande-oro 900ms ease-out; }',
   900),

  ('Explosión mayor', 'premio', 'premio_mayor', 'pantalla',
   E'@keyframes explosion-mayor-oro {\n  0% { opacity:0; transform:scale(.5); }\n  25% { opacity:1; transform:scale(1.1); }\n  60% { opacity:.8; transform:scale(1); }\n  100% { opacity:0; transform:scale(1.05); }\n}\n.efecto-premio { background: radial-gradient(circle, rgba(217,164,65,.7), rgba(217,164,65,.2) 50%, transparent 75%); animation: explosion-mayor-oro 1300ms ease-out; }',
   1300)

) as e(nombre, tipo, nivel, pos, css, dur)
where j.slug = 'rodillos-de-oro';

-- Confirmación
select
  j.nombre,
  j.motor,
  j.estado,
  (select count(*) from simbolos where juego_id = j.id) as simbolos,
  (select count(*) from efectos where juego_id = j.id) as efectos
from juegos j where j.slug = 'rodillos-de-oro';
