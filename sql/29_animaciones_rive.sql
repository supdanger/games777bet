-- =========================================================
-- Animaciones Rive del juego (aparte de las de cada símbolo).
--
-- Una sola tabla para las dos cosas, porque comparten todo salvo
-- cuándo se prenden:
--
--   evento 'intro'         — corre ANTES de la pantalla de carga,
--                            una sola por juego. La carga de
--                            imágenes y sonidos arranca en paralelo,
--                            así la intro no suma tiempo de espera.
--   evento 'girar'         — al arrancar el giro.
--   evento 'premio_chico'  — dos o tres iguales.
--   evento 'premio_mayor'  — el premio grande.
--
-- Las de premio son el complemento de lo que ya hace el símbolo: el
-- símbolo festeja porque él ganó, esto pone la escena alrededor (el
-- dragón escupiendo fuego, la sandía que revienta en monedas).
--
-- Tope acordado: 2 por evento (salvo intro, que es 1). No es un
-- límite técnico sino de criterio — cada instancia de Rive es un
-- motor de dibujo propio corriendo, y más de eso empieza a competir
-- con la animación de los rodillos, que es la que no puede tironear.
-- =========================================================

create table if not exists animaciones_rive (
  id         uuid primary key default gen_random_uuid(),
  juego_id   uuid not null references juegos(id) on delete cascade,
  evento     text not null default 'premio_mayor'
             check (evento in ('intro', 'girar', 'premio_chico', 'premio_mayor')),
  riv_url    text,
  -- Nombre del disparador dentro del .riv. Si queda vacío, la
  -- animación arranca sola al mostrarse (que es lo normal en una
  -- animación de una sola pasada, como la intro).
  disparador text,
  x          numeric(6,2) not null default 50,
  y          numeric(6,2) not null default 50,
  tamano     numeric(6,2) not null default 60,
  orden      integer      not null default 0,
  created_at timestamptz  not null default now()
);

alter table animaciones_rive enable row level security;

drop policy if exists "con sesion, todo" on animaciones_rive;
create policy "con sesion, todo" on animaciones_rive for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- duplicar_juego tiene que copiar también estas animaciones; si no,
-- un juego duplicado perdería la intro y los complementos.
create or replace function duplicar_juego(p_juego_id uuid, p_nombre text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nuevo_id uuid := gen_random_uuid();
  v_datos    jsonb;
  v_tabla    text;
begin
  if exists (select 1 from juegos where slug = p_slug) then
    raise exception 'Ya existe un juego con el slug "%"', p_slug;
  end if;

  select to_jsonb(j) into v_datos from juegos j where j.id = p_juego_id;
  if v_datos is null then
    raise exception 'No se encontró el juego a duplicar';
  end if;

  v_datos := v_datos || jsonb_build_object(
    'id', v_nuevo_id, 'nombre', p_nombre, 'slug', p_slug,
    'estado', 'borrador', 'publicado', false, 'version', 1,
    'created_at', now(), 'updated_at', now()
  );

  insert into juegos select * from jsonb_populate_record(null::juegos, v_datos);

  -- Todas las tablas hijas se copian igual: se recorren por nombre en
  -- vez de repetir el mismo bloque siete veces. Agregar una tabla
  -- hija nueva en el futuro es sumarla a esta lista y nada más.
  foreach v_tabla in array array[
    'simbolos', 'sonidos', 'efectos', 'premios_visuales',
    'digitos', 'capas_libres', 'botones', 'cadenas_luces', 'animaciones_rive'
  ] loop
    execute format(
      'insert into %I select * from jsonb_populate_recordset(null::%I, (
         select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object(
           ''id'', gen_random_uuid(), ''juego_id'', $1)), ''[]''::jsonb)
         from %I x where x.juego_id = $2))',
      v_tabla, v_tabla, v_tabla
    ) using v_nuevo_id, p_juego_id;
  end loop;

  return v_nuevo_id;
end;
$$;
