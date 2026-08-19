import crypto from 'node:crypto';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { multiplicador, puedeRetirar, TOTAL_CASILLAS } from '../motor/mines-clasico.js';

function idJugador(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const { token, slug, roundId, casilla } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Falta el token' });
    const idx = Number(casilla);
    if (!Number.isInteger(idx) || idx < 0 || idx >= TOTAL_CASILLAS) {
      return res.status(400).json({ error: 'Casilla inválida' });
    }

    const jugadorId = idJugador(token);

    const [{ data: juego }, { data: ronda }] = await Promise.all([
      supabaseAdmin.from('juegos').select('*').eq('slug', slug).maybeSingle(),
      supabaseAdmin.from('mines_rondas').select('*').eq('id', roundId).maybeSingle(),
    ]);
    if (!juego || !ronda) return res.status(404).json({ error: 'Partida no encontrada' });
    // La partida tiene que ser de este jugador y de este juego — sin
    // esto, alguien con el roundId de otra persona podría destapar
    // casillas en una partida ajena.
    if (ronda.jugador_id !== jugadorId || ronda.juego_id !== juego.id) {
      return res.status(403).json({ error: 'Esa partida no te pertenece' });
    }
    if (ronda.estado !== 'en_curso') {
      return res.status(400).json({ error: 'Esta partida ya terminó' });
    }

    const reveladas = ronda.reveladas || [];
    if (reveladas.includes(idx)) {
      return res.status(400).json({ error: 'Esa casilla ya está destapada' });
    }
    // Si ya se destaparon todas las casillas seguras posibles, no
    // queda nada más que minas — sin este corte, el jugador podía
    // seguir tocando y perder todo lo ganado contra una mina
    // garantizada, en vez de verse obligado a retirar un tablero que
    // ya limpió por completo.
    if (reveladas.length >= TOTAL_CASILLAS - ronda.minas) {
      return res.status(400).json({ error: 'Ya destapaste todas las casillas seguras — retirá para cobrar.' });
    }

    const esMina = ronda.posiciones_mina.includes(idx);

    if (esMina) {
      // Perdió: se revela dónde estaban TODAS las minas — recién
      // acá, con la partida ya cerrada, es seguro mostrarlas.
      //
      // La condición "and('version', ronda.version)" es lo que hace
      // esto seguro ante dos pedidos simultáneos: si otro pedido ya
      // escribió sobre esta fila entre que la leímos y este punto,
      // la versión ya cambió y esta escritura no afecta ninguna
      // fila — se detecta abajo y se corta en vez de seguir con un
      // resultado que ya no es el más reciente.
      const { data: filas, error } = await supabaseAdmin.from('mines_rondas').update({
        estado: 'perdida', reveladas: [...reveladas, idx], ganancia_final: 0,
        version: ronda.version + 1, updated_at: new Date().toISOString(),
      }).eq('id', ronda.id).eq('version', ronda.version).select();
      if (error) throw new Error(error.message);
      if (!filas?.length) {
        return res.status(409).json({ error: 'Otra operación ya actualizó esta partida — volvé a consultar el estado antes de reintentar.' });
      }

      return res.status(200).json({
        esMina: true, casilla: idx, estado: 'perdida',
        posicionesMina: ronda.posiciones_mina,
      });
    }

    // Segura: sube el multiplicador y se fija si ya se puede retirar.
    const nuevasReveladas = [...reveladas, idx];
    const aciertos = nuevasReveladas.length;
    const mult = multiplicador(ronda.minas, aciertos, Number(juego.mines_margen_pct));
    const retiroHabilitado = puedeRetirar(ronda.minas, aciertos);
    const tableroCompleto = aciertos >= TOTAL_CASILLAS - ronda.minas;

    const { data: filas, error } = await supabaseAdmin.from('mines_rondas').update({
      reveladas: nuevasReveladas, multiplicador_actual: mult,
      version: ronda.version + 1, updated_at: new Date().toISOString(),
    }).eq('id', ronda.id).eq('version', ronda.version).select();
    if (error) throw new Error(error.message);
    if (!filas?.length) {
      return res.status(409).json({ error: 'Otra operación ya actualizó esta partida — volvé a consultar el estado antes de reintentar.' });
    }

    return res.status(200).json({
      esMina: false, casilla: idx, estado: 'en_curso',
      multiplicador: mult, puedeRetirar: retiroHabilitado, tableroCompleto,
    });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'No se pudo destapar la casilla' });
  }
}
