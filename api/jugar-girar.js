import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { girar } from '../motor/clasico-3x3.js';
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

    // Las dos consultas salen juntas: ninguna depende del resultado
    // de la otra, solo del slug y el clientId.
    const [{ data: juego }, { data: existente }] = await Promise.all([
      supabaseAdmin.from('juegos').select('*').eq('slug', slug).eq('estado', 'listo').maybeSingle(),
      supabaseAdmin.from('rondas_jugadas').select('*').eq('client_id', clientId).maybeSingle(),
    ]);
    if (!juego) return res.status(404).json({ error: 'Juego no encontrado' });

    // Reintento del mismo giro (se cortó la conexión, etc.): se
    // devuelve lo que ya se resolvió, sin volver a tocar el saldo.
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

    // Los símbolos se piden mientras Win777 procesa el débito: las dos
    // cosas tardan y no dependen entre sí. Si el débito falla, la
    // consulta de símbolos se descarta sola.
    const [simbolosRes, trasApostar] = await Promise.all([
      supabaseAdmin.from('simbolos').select('*').eq('juego_id', juego.id),
      apostar(token, clientId, monto),
    ]);
    const simbolos = simbolosRes.data;
    if (!simbolos?.length) return res.status(400).json({ error: 'El juego no tiene símbolos configurados' });

    // Resultado — se calcula acá, el mismo roundId (clientId) va en la
    // llamada de premiar de abajo, para que Win777 pueda relacionar
    // ambas llamadas con la misma jugada.
    const resultado = girar(simbolos);

    // Redondeado a 2 decimales: sin esto, un multiplicador con coma
    // puede dejar fracciones de guaraní que no cuadran con la caja.
    const ganancia = Number((Number(resultado.premio || 0) * monto).toFixed(2));

    // Acreditar en Win777 si hubo premio.
    let saldoFinal;
    if (ganancia > 0) {
      saldoFinal = Number((await premiar(token, clientId, ganancia)).balance);
      // Si Win777 no devuelve un saldo usable, mejor cortar acá con un
      // error visible que mostrarle al jugador un saldo inventado.
      if (!Number.isFinite(saldoFinal)) {
        throw new Error('Win777 no devolvió un saldo válido después del premio');
      }
    } else {
      saldoFinal = Number(trasApostar.balance);
    }

    // Guardado best-effort para la idempotencia local. NO se espera:
    // el jugador ya tiene su resultado y su saldo actualizado en
    // Win777, que es la fuente de verdad. Si esta escritura fallara,
    // un reintento con el mismo client_id sigue siendo seguro porque
    // Win777 también es idempotente por roundId.
    supabaseAdmin.from('rondas_jugadas').insert({
      juego_id: juego.id, client_id: clientId, apuesta: monto, premio: ganancia,
      nivel_premio: resultado.nivel, grilla: resultado.grilla, saldo_despues: saldoFinal,
    }).then(({ error }) => { if (error) console.error('No se pudo registrar la ronda:', error.message); });

    return res.status(200).json({
      grilla: resultado.grilla, premio: ganancia, nivel: resultado.nivel,
      filaPago: resultado.filaPago, saldo: saldoFinal, repetido: false,
    });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Error al resolver el giro' });
  }
}
