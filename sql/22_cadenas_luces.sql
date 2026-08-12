-- =========================================================
-- Cadenas de luces: igual que las imágenes libres, cantidad
-- ilimitada por juego. Cada una es una fila propia con su modo,
-- cantidad de focos, tamaño, animación, velocidad y colores.
--
-- modo 'marco'  — los focos se distribuyen solos alrededor del
--                 marco actual (si el marco se mueve o cambia de
--                 tamaño, la cadena lo sigue, no queda una copia
--                 vieja de la posición).
-- modo 'libre'  — cada foco tiene su propia posición (x,y en % del
--                 juego), guardada en "puntos". Se arrastran a mano
--                 en la vista previa.
--
-- colores es un arreglo de 1 a 8 colores — no está fijo en dos, cada
-- animación los usa distinto (ver comentarios en el código).
-- =========================================================

create table if not exists cadenas_luces (
  id         uuid primary key default gen_random_uuid(),
  juego_id   uuid not null references juegos(id) on delete cascade,
  modo       text not null default 'marco' check (modo in ('marco', 'libre')),
  cantidad   integer not null default 12 check (cantidad between 2 and 40),
  tamano     numeric(6,2) not null default 11,
  animacion  text not null default 'secuencial' check (animacion in ('secuencial', 'sincronizado', 'ola')),
  velocidad  numeric(6,2) not null default 1,
  colores    text[] not null default '{"#EF9F27","#378ADD"}',
  -- Solo se usa en modo 'libre'. Ej: [{"x":15,"y":50}, {"x":22,"y":50}, ...]
  puntos     jsonb not null default '[]',
  orden      integer not null default 0,
  created_at timestamptz not null default now()
);

alter table cadenas_luces enable row level security;

drop policy if exists "con sesion, todo" on cadenas_luces;
create policy "con sesion, todo" on cadenas_luces for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- duplicar_juego (SQL 21) ya copiaba todas las tablas hijas; se
-- reemplaza para que también copie las cadenas de luces, que son
-- posteriores a esa migración.
create or replace function duplicar_juego(p_juego_id uuid, p_nombre text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nuevo_id uuid := gen_random_uuid();
  v_datos    jsonb;
begin
  if exists (select 1 from juegos where slug = p_slug) then
    raise exception 'Ya existe un juego con el slug "%"', p_slug;
  end if;

  select to_jsonb(j) into v_datos from juegos j where j.id = p_juego_id;

  if v_datos is null then
    raise exception 'No se encontró el juego a duplicar';
  end if;

  v_datos := v_datos
    || jsonb_build_object(
         'id', v_nuevo_id,
         'nombre', p_nombre,
         'slug', p_slug,
         'estado', 'borrador',
         'publicado', false,
         'version', 1,
         'created_at', now(),
         'updated_at', now()
       );

  insert into juegos select * from jsonb_populate_record(null::juegos, v_datos);

  insert into simbolos
  select * from jsonb_populate_recordset(null::simbolos, (
    select coalesce(jsonb_agg(to_jsonb(s) || jsonb_build_object('id', gen_random_uuid(), 'juego_id', v_nuevo_id)), '[]'::jsonb)
    from simbolos s where s.juego_id = p_juego_id
  ));

  insert into sonidos
  select * from jsonb_populate_recordset(null::sonidos, (
    select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('id', gen_random_uuid(), 'juego_id', v_nuevo_id)), '[]'::jsonb)
    from sonidos x where x.juego_id = p_juego_id
  ));

  insert into efectos
  select * from jsonb_populate_recordset(null::efectos, (
    select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('id', gen_random_uuid(), 'juego_id', v_nuevo_id)), '[]'::jsonb)
    from efectos x where x.juego_id = p_juego_id
  ));

  insert into premios_visuales
  select * from jsonb_populate_recordset(null::premios_visuales, (
    select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('id', gen_random_uuid(), 'juego_id', v_nuevo_id)), '[]'::jsonb)
    from premios_visuales x where x.juego_id = p_juego_id
  ));

  insert into digitos
  select * from jsonb_populate_recordset(null::digitos, (
    select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('id', gen_random_uuid(), 'juego_id', v_nuevo_id)), '[]'::jsonb)
    from digitos x where x.juego_id = p_juego_id
  ));

  insert into capas_libres
  select * from jsonb_populate_recordset(null::capas_libres, (
    select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('id', gen_random_uuid(), 'juego_id', v_nuevo_id)), '[]'::jsonb)
    from capas_libres x where x.juego_id = p_juego_id
  ));

  insert into botones
  select * from jsonb_populate_recordset(null::botones, (
    select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('id', gen_random_uuid(), 'juego_id', v_nuevo_id)), '[]'::jsonb)
    from botones x where x.juego_id = p_juego_id
  ));

  insert into cadenas_luces
  select * from jsonb_populate_recordset(null::cadenas_luces, (
    select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('id', gen_random_uuid(), 'juego_id', v_nuevo_id)), '[]'::jsonb)
    from cadenas_luces x where x.juego_id = p_juego_id
  ));

  return v_nuevo_id;
end;
$$;
