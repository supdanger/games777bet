import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { girar } from './_lib/girar.js';
import { apostar, premiar } from './_lib/proveedorCliente.js';

// Resuelve un giro con plata real. El navegador manda la apuesta y
// un client_id (generado una vez por giro); acá se debita en
// Win777, se calcula el resultado, y si hay premio se acredita —
// todo en ese orden, nunca al revés. El navegador nunca decide el
// resultado ni el monto, solo lo pide y lo muestra.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const { token, slug, apuesta, clientId } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Falta el token' });
    if (!clientId) return res.status(400).json({ error: 'Falta clientId' });

    const { data: juego } = await supabaseAdmin
      .from('juegos').select('*').eq('slug', slug).eq('estado', 'listo').maybeSingle();
    if (!juego) return res.status(404).json({ error: 'Juego no encontrado' });

    // Reintento del mismo giro (se cortó la conexión, etc.): se
    // devuelve lo que ya se resolvió, sin volver a tocar el saldo.
    const { data: existente } = await supabaseAdmin
      .from('rondas_jugadas').select('*').eq('client_id', clientId).maybeSingle();

    if (existente) {
      return res.status(200).json({
        grilla: existente.grilla, premio: Number(existente.premio),
        nivel: existente.nivel_premio, saldo: Number(existente.saldo_despues), repetido: true,
      });
    }

    const monto = Number(apuesta);
    if (!monto || monto <= 0) return res.status(400).json({ error: 'Apuesta inválida' });
    if (monto < Number(juego.min_bet) || monto > Number(juego.max_bet)) {
      return res.status(400).json({ error: `La apuesta debe estar entre ${juego.min_bet} y ${juego.max_bet}` });
    }

    const { data: simbolos } = await supabaseAdmin.from('simbolos').select('*').eq('juego_id', juego.id);
    if (!simbolos?.length) return res.status(400).json({ error: 'El juego no tiene símbolos configurados' });

    // 1) Debitar en Win777 ANTES de saber el resultado.
    const trasApostar = await apostar(token, clientId, monto);

    // 2) Resultado — se calcula acá, el mismo roundId (clientId) va
    // en la llamada de premiar de abajo, para que Win777 pueda
    // relacionar ambas llamadas con la misma jugada.
    const resultado = girar(simbolos);
    const ganancia = resultado.premio * monto;

    // 3) Acreditar en Win777 si hubo premio.
    const saldoFinal = ganancia > 0
      ? Number((await premiar(token, clientId, ganancia)).balance)
      : Number(trasApostar.balance);

    // Guardado best-effort para la idempotencia local: si esto
    // fallara, un reintento con el mismo client_id sigue siendo
    // seguro porque Win777 también es idempotente por roundId.
    await supabaseAdmin.from('rondas_jugadas').insert({
      juego_id: juego.id, client_id: clientId, apuesta: monto, premio: ganancia,
      nivel_premio: resultado.nivel, grilla: resultado.grilla, saldo_despues: saldoFinal,
    });

    return res.status(200).json({
      grilla: resultado.grilla, premio: ganancia, nivel: resultado.nivel, saldo: saldoFinal, repetido: false,
    });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Error al resolver el giro' });
  }
}
