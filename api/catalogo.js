import { supabaseAdmin } from './_lib/supabaseAdmin.js';

// Catálogo público, en el formato que ya espera la función
// "Sincronizar catálogo" del panel de Win777: { proveedor, juegos:
// [...] }. Solo trae juegos listo + publicado — un juego "listo"
// pero sin publicar todavía no debe salir acá.
//
// Sin autenticación: Win777 hoy no manda ningún secreto al leer
// esta URL (es un simple fetch), así que no hay nada que validar de
// ese lado. No es un problema porque acá no viaja nada sensible —
// nombres, imágenes, límites de apuesta, la URL pública del juego.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  const { data: juegos, error } = await supabaseAdmin
    .from('juegos')
    .select('slug, nombre, descripcion, portada_url, min_bet, max_bet, version')
    .eq('estado', 'listo')
    .eq('publicado', true);

  if (error) return res.status(500).json({ error: error.message });

  const origen = `https://${req.headers.host}`;

  return res.status(200).json({
    proveedor: 'gameswin777',
    juegos: (juegos || []).map((j) => ({
      slug: j.slug,
      nombre: j.nombre,
      descripcion: j.descripcion || undefined,
      imagen_url: j.portada_url || undefined,
      motor: 'gameswin777',
      version: j.version,
      min_bet: Number(j.min_bet),
      max_bet: Number(j.max_bet),
      launch_url: `${origen}/jugar.html?slug=${encodeURIComponent(j.slug)}`,
    })),
  });
}
