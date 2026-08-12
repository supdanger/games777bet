-- =========================================================
-- Duplicar un juego completo: la fila de juegos más TODO lo que
-- cuelga de ella (símbolos, sonidos, efectos, premios visuales,
-- dígitos, capas libres, botones). Con 300 juegos por delante, armar
-- cada uno desde cero no escala — se clona uno ya ajustado y solo se
-- cambian arte y pagos.
--
-- Va como función SQL y no como una tanda de inserts desde el
-- navegador porque así es atómica: o se copia todo, o no se copia
-- nada. Si se cortara a la mitad quedaría un juego mutilado sin
-- forma obvia de darse cuenta.
--
-- La copia se arma con jsonb, no listando columnas una por una: así
-- sigue funcionando cuando agregues columnas nuevas en el futuro,
-- sin tener que acordarte de actualizar esta función.
--
-- La copia SIEMPRE entra como borrador y sin publicar, aunque el
-- original esté publicado: nada llega al catálogo de Win777 sin que
-- alguien lo revise antes.
--
-- NO se copian las rondas jugadas: son el historial del original.
-- Mezclarlas arruinaría el RTP real de los dos juegos.
-- =========================================================

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

  -- Lo propio de la copia se pisa; todo lo demás (imágenes,
  -- posiciones, capas, modo de apuesta, fichas) se hereda tal cual.
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

  -- Tablas hijas. Mismo criterio: se copia todo menos id y juego_id.
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

  return v_nuevo_id;
end;
$$;
