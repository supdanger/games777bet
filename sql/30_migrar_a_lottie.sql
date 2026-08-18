-- =========================================================
-- Cambio de proveedor de animaciones: Rive -> Lottie.
--
-- Motivo: Rive dejó de permitir exportar el .riv en el plan
-- gratuito. Lottie sí, y además hay herramientas que ya generan y
-- descargan animaciones Lottie directo, sin curva de aprendizaje.
--
-- Como todavía no existía ningún .riv real cargado, esto es un
-- renombre limpio, no una migración de datos.
--
-- Diferencia de diseño importante: Lottie no tiene "disparadores"
-- con nombre como Rive (máquina de estados). Es un reproductor
-- lineal: carga, reproduce, avisa cuando termina. Por eso:
--
--   - Cada símbolo pasa a tener DOS archivos (uno para premio chico,
--     otro para premio mayor) en vez de un archivo con dos
--     disparadores internos. Es además más práctico: cada reacción
--     es directamente un archivo que descargás ya hecho.
--   - Las animaciones del juego (intro/girar/premio) pierden el
--     campo "disparador" — simplemente se muestran y reproducen
--     solas, no hace falta decirles cuándo arrancar.
-- =========================================================

alter table simbolos
  drop column if exists riv_url,
  drop column if exists riv_trigger_chico,
  drop column if exists riv_trigger_grande,
  add column if not exists lottie_chico_url  text,
  add column if not exists lottie_grande_url text;

-- Renombrar preserva los datos, las políticas RLS y los índices —
-- no hace falta recrear nada de eso.
alter table animaciones_rive rename to animaciones_lottie;
alter table animaciones_lottie rename column riv_url to lottie_url;
alter table animaciones_lottie drop column if exists disparador;

-- duplicar_juego apuntaba a la tabla vieja por nombre; se actualiza
-- la lista para que copie la nueva.
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

  foreach v_tabla in array array[
    'simbolos', 'sonidos', 'efectos', 'premios_visuales',
    'digitos', 'capas_libres', 'botones', 'cadenas_luces', 'animaciones_lottie'
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
