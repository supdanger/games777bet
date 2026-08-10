-- =========================================================
-- Juego de demostración: "Frutas del 777"
-- Slot 3x3 clásico, tema frutas, con comodín (wild).
-- RTP calibrado a ~91% — volatilidad media-baja, para que el
-- jugador de prueba gane seguido y no se frustre.
--
-- Corré esto en el SQL Editor de gameswin777 DESPUÉS del
-- 01_esquema.sql. Es seguro correrlo más de una vez: borra el
-- juego anterior con el mismo slug antes de recrearlo.
-- =========================================================

-- Si ya existía una demo con este slug, la borramos (cascade se
-- lleva símbolos, efectos y sonidos de un tirón).
delete from juegos where slug = 'frutas-del-777';

-- El juego
with nuevo as (
  insert into juegos (slug, nombre, descripcion, estado, motor, min_bet, max_bet)
  values (
    'frutas-del-777',
    'Frutas del 777',
    'Clásico de frutas con comodín. Tres iguales en la línea del medio pagan; el comodín completa cualquier combinación.',
    'listo',
    'clasico-3x3',
    1000,
    50000
  )
  returning id
)
-- Símbolos (RTP ~90.7%). El orden es de más común a más raro.
insert into simbolos (juego_id, nombre, peso, pago_tres, pago_dos, orden)
select id, v.nombre, v.peso, v.tres, v.dos, v.orden
from nuevo, (values
  ('cereza',   25, 4,   1,  0),
  ('limon',    22, 6,   2,  1),
  ('naranja',  18, 9,   2,  2),
  ('sandia',   14, 18,  4,  3),
  ('uva',      10, 38,  6,  4),
  ('campana',  6,  76,  11, 5),
  ('estrella', 3,  190, 24, 6),
  ('wild',     2,  400, 48, 7)
) as v(nombre, peso, tres, dos, orden);

-- Efectos visuales (CSS). Tres de premio, uno de carcasa.
insert into efectos (juego_id, nombre, tipo, nivel_premio, posicion, css, duracion_ms)
select id, e.nombre, e.tipo, e.nivel, e.pos, e.css, e.dur
from juegos j, (values

  -- Carcasa: brillo dorado que respira siempre alrededor del marco
  ('Brillo del marco', 'carcasa', null, null,
   E'@keyframes brillo-marco {\n  0%,100% { box-shadow: inset 0 0 20px rgba(217,164,65,.15); }\n  50% { box-shadow: inset 0 0 35px rgba(217,164,65,.4); }\n}\n.efecto { position:absolute; inset:0; border-radius:20px; pointer-events:none; animation: brillo-marco 3s ease-in-out infinite; }',
   3000),

  -- Dos iguales: destello suave sobre la línea
  ('Destello chico', 'premio', 'dos_iguales', 'linea',
   E'@keyframes destello-chico {\n  0% { opacity:0; transform:scale(.9); }\n  40% { opacity:.7; transform:scale(1.05); }\n  100% { opacity:0; transform:scale(1); }\n}\n.efecto-premio { background: radial-gradient(ellipse, rgba(107,138,253,.5), transparent 70%); animation: destello-chico 700ms ease-out; }',
   700),

  -- Tres iguales: brillo más fuerte sobre la línea
  ('Destello grande', 'premio', 'tres_iguales', 'linea',
   E'@keyframes destello-grande {\n  0% { opacity:0; transform:scale(.8); }\n  30% { opacity:1; transform:scale(1.15); }\n  100% { opacity:0; transform:scale(1); }\n}\n.efecto-premio { background: radial-gradient(ellipse, rgba(91,191,136,.6), transparent 65%); animation: destello-grande 900ms ease-out; }',
   900),

  -- Premio mayor: destello dorado que cubre toda la pantalla
  ('Explosión mayor', 'premio', 'premio_mayor', 'pantalla',
   E'@keyframes explosion-mayor {\n  0% { opacity:0; transform:scale(.5); }\n  25% { opacity:1; transform:scale(1.1); }\n  60% { opacity:.8; transform:scale(1); }\n  100% { opacity:0; transform:scale(1.05); }\n}\n.efecto-premio { background: radial-gradient(circle, rgba(217,164,65,.7), rgba(217,164,65,.2) 50%, transparent 75%); animation: explosion-mayor 1300ms ease-out; }',
   1300)

) as e(nombre, tipo, nivel, pos, css, dur)
where j.slug = 'frutas-del-777';

-- Confirmación
select
  j.nombre,
  j.estado,
  (select count(*) from simbolos where juego_id = j.id) as simbolos,
  (select count(*) from efectos where juego_id = j.id) as efectos
from juegos j where j.slug = 'frutas-del-777';
