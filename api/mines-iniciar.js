import crypto from 'node:crypto';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { colocarMinas, minasValidas, TOTAL_CASILLAS } from '../motor/mines-clasico.js';
import { apostar } from './_lib/proveedorCliente.js';

// El token de Win777 identifica al jugador, pero es un dato sensible
// de sesión — no se guarda tal cual en la base. Se guarda su hash,
// que alcanza para dos cosas: reconocer "es el mismo jugador" entre
// pedidos, y el índice único de mines_rondas que impide dos partidas
// en curso a la vez para el mismo jugador y juego.
function idJugador(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Lo que ve el cliente de una ronda EN CURSO nunca incluye
// posiciones_mina — eso es tan importante acá como que el servidor
// calcule el resultado en los slots.
function formatearRonda(ronda) {
  return {
    roundId: ronda.id,
    minas: ronda.minas,
    reveladas: ronda.reveladas,
    estado: ronda.estado,
    multiplicador: Number(ronda.multiplicador_actual),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const { token, slug, apuesta, minas } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Falta el token' });
    if (!minasValidas(Number(minas))) {
      return res.status(400).json({ error: `La cantidad de minas debe ser entre 1 y ${TOTAL_CASILLAS - 1}` });
    }

    const jugadorId = idJugador(token);

    const { data: juego } = await supabaseAdmin.from('juegos').select('*')
      .eq('slug', slug).eq('estado', 'listo').maybeSingle();
    if (!juego) return res.status(404).json({ error: 'Juego no encontrado' });

    // Si ya hay una partida en curso para este jugador y juego, se
    // devuelve ESA en vez de arrancar una segunda — el índice único
    // de la base ya lo impediría, pero así contesta algo útil en vez
    // de un error de restricción violada. El jugador tiene que
    // terminarla (perder o retirar) antes de poder empezar otra.
    const { data: enCurso } = await supabaseAdmin.from('mines_rondas').select('*')
      .eq('juego_id', juego.id).eq('jugador_id', jugadorId).eq('estado', 'en_curso').maybeSingle();
    if (enCurso) return res.status(200).json({ ...formatearRonda(enCurso), yaExistia: true });

    const monto = Number(apuesta);
    if (!monto || monto <= 0) return res.status(400).json({ error: 'Apuesta inválida' });
    if (monto < Number(juego.min_bet) || monto > Number(juego.max_bet)) {
      return res.status(400).json({ error: `La apuesta debe estar entre ${juego.min_bet} y ${juego.max_bet}` });
    }

    // roundId propio: es tanto el id de la fila en mines_rondas como
    // el roundId que Win777 va a relacionar entre este débito y el
    // crédito de cuando se retire — tienen que ser el mismo valor en
    // las dos puntas, por eso se genera acá y no se deja que la base
    // ponga uno por su cuenta.
    const roundId = crypto.randomUUID();
    const posicionesMina = colocarMinas(Number(minas));

    // Importante el ORDEN acá: primero se reserva el lugar en la
    // base, RECIÉN DESPUÉS se cobra. El índice único de la tabla
    // (una partida en_curso por jugador y juego) es lo que hace esto
    // seguro: si dos pedidos de "iniciar" llegan casi juntos, los dos
    // pueden pasar el chequeo de arriba, pero acá solo UNO de los dos
    // logra insertar su fila — el otro falla ACÁ, antes de haber
    // cobrado nada. Con el orden invertido (cobrar primero, insertar
    // después) un choque así debitaba al jugador dos veces y le
    // quedaba una sola partida.
    const { data: ronda, error: errorInsert } = await supabaseAdmin.from('mines_rondas').insert({
      id: roundId, juego_id: juego.id, jugador_id: jugadorId,
      apuesta: monto, minas: Number(minas),
      posiciones_mina: posicionesMina, reveladas: [],
    }).select().single();

    if (errorInsert) {
      // El código 23505 de Postgres es "violó una restricción única"
      // — significa que otro pedido ganó la carrera y ya creó la
      // partida en curso. Como esto pasó ANTES de cobrar nada, es
      // seguro simplemente contestar con la partida que ya existe.
      if (errorInsert.code === '23505') {
        const { data: enCurso2 } = await supabaseAdmin.from('mines_rondas').select('*')
          .eq('juego_id', juego.id).eq('jugador_id', jugadorId).eq('estado', 'en_curso').maybeSingle();
        if (enCurso2) return res.status(200).json({ ...formatearRonda(enCurso2), yaExistia: true });
      }
      throw new Error(errorInsert.message);
    }

    // Recién ACÁ se cobra, con la partida ya reservada de forma
    // segura. Si esto falla (saldo insuficiente, Win777 caído), se
    // borra la fila reservada — si no, el jugador quedaría con una
    // partida "en curso" fantasma, sin haber pagado nada, bloqueando
    // que arranque una de verdad.
    let trasApostar;
    try {
      trasApostar = await apostar(token, roundId, monto);
    } catch (err) {
      await supabaseAdmin.from('mines_rondas').delete().eq('id', roundId);
      throw err;
    }

    return res.status(200).json({ ...formatearRonda(ronda), saldo: Number(trasApostar.balance), yaExistia: false });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'No se pudo iniciar la partida' });
  }
}
