import { supabaseAdmin } from './_lib/supabaseAdmin.js';

// Datos de un juego para la pantalla jugable real. Sin login: acá
// no hay nada sensible (símbolos, imágenes, efectos) — el saldo del
// jugador nunca vive en esta base, siempre en la de Win777.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  const slug = req.query.slug;
  if (!slug) return res.status(400).json({ error: 'Falta el slug del juego' });

  const { data: juego } = await supabaseAdmin
    .from('juegos').select('*').eq('slug', slug).eq('estado', 'listo').maybeSingle();

  if (!juego) return res.status(404).json({ error: 'Juego no encontrado, o todavía no está marcado como Listo' });

  const [
    { data: simbolos }, { data: sonidos }, { data: efectos },
    { data: premios }, { data: digitos }, { data: capasLibres }, { data: botones },
    { data: cadenasLuces }, { data: animaciones },
  ] = await Promise.all([
    supabaseAdmin.from('simbolos').select('*').eq('juego_id', juego.id).order('orden'),
    supabaseAdmin.from('sonidos').select('*').eq('juego_id', juego.id),
    supabaseAdmin.from('efectos').select('*').eq('juego_id', juego.id),
    supabaseAdmin.from('premios_visuales').select('*').eq('juego_id', juego.id),
    supabaseAdmin.from('digitos').select('*').eq('juego_id', juego.id),
    supabaseAdmin.from('capas_libres').select('*').eq('juego_id', juego.id).order('orden'),
    supabaseAdmin.from('botones').select('*').eq('juego_id', juego.id),
    supabaseAdmin.from('cadenas_luces').select('*').eq('juego_id', juego.id).order('orden'),
    supabaseAdmin.from('animaciones_lottie').select('*').eq('juego_id', juego.id).order('orden'),
  ]);

  if (!simbolos?.length) return res.status(400).json({ error: 'Este juego todavía no tiene símbolos configurados' });

  return res.status(200).json({
    juego, simbolos, sonidos: sonidos || [], efectos: efectos || [],
    premios: premios || [], digitos: digitos || [], capasLibres: capasLibres || [],
    botones: botones || [], cadenasLuces: cadenasLuces || [], animaciones: animaciones || [],
  });
}
