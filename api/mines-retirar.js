import crypto from 'node:crypto';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { multiplicador, puedeRetirar } from '../motor/mines-clasico.js';
import { premiar } from './_lib/proveedorCliente.js';

function idJugador(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const { token, slug, roundId } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Falta el token' });

    const jugadorId = idJugador(token);

    const [{ data: juego }, { data: ronda }] = await Promise.all([
      supabaseAdmin.from('juegos').select('*').eq('slug', slug).maybeSingle(),
      supabaseAdmin.from('mines_rondas').select('*').eq('id', roundId).maybeSingle(),
    ]);
    if (!juego || !ronda) return res.status(404).json({ error: 'Partida no encontrada' });
    if (ronda.jugador_id !== jugadorId || ronda.juego_id !== juego.id) {
      return res.status(403).json({ error: 'Esa partida no te pertenece' });
    }

    // Reintento de un retiro ya procesado (se cortó la conexión,
    // etc.): se devuelve lo que ya se pagó, sin cobrar dos veces.
    if (ronda.estado === 'retirada') {
      return res.status(200).json({
        ganancia: Number(ronda.ganancia_final), multiplicador: Number(ronda.multiplicador_actual), repetido: true,
      });
    }
    if (ronda.estado !== 'en_curso') {
      return res.status(400).json({ error: 'Esta partida ya terminó y no se puede retirar' });
    }

    const aciertos = (ronda.reveladas || []).length;
    // El servidor nunca confía en el multiplicador que ya tenía
    // guardado la fila — lo recalcula desde cero con la cantidad de
    // minas y aciertos reales, igual que el resultado de un giro se
    // calcula siempre en el servidor y no se toma del cliente.
    if (!puedeRetirar(ronda.minas, aciertos)) {
      return res.status(400).json({ error: 'Todavía no se puede retirar — falta llegar al próximo punto de retiro.' });
    }

    const mult = multiplicador(ronda.minas, aciertos, Number(juego.mines_margen_pct));
    const ganancia = Number((Number(ronda.apuesta) * mult).toFixed(2));

    // Se "reclama" el retiro ANTES de llamar a Win777, con una
    // escritura condicional a la versión que se leyó. Si dos pedidos
    // de retiro llegaron casi juntos, los dos calculan la misma
    // ganancia (porque partieron de la misma fila), pero la
    // condición ".eq('version', ronda.version)" hace que la base
    // solo deje pasar a UNO de los dos — el otro obtiene cero filas
    // afectadas y sabe que llegó tarde SIN haber llamado a premiar()
    // todavía, así no hay ni siquiera un intento de pago de más.
    const { data: filasReclamadas, error: errorReclamo } = await supabaseAdmin.from('mines_rondas')
      .update({ estado: 'retirada', ganancia_final: ganancia, multiplicador_actual: mult, version: ronda.version + 1, updated_at: new Date().toISOString() })
      .eq('id', ronda.id).eq('version', ronda.version).eq('estado', 'en_curso').select();
    if (errorReclamo) throw new Error(errorReclamo.message);

    if (!filasReclamadas?.length) {
      // Alguien más ya procesó esta partida en el momento exacto en
      // que este pedido también quería hacerlo. Se relee el estado
      // real y se contesta en consecuencia, en vez de fallar sin más.
      const { data: actual } = await supabaseAdmin.from('mines_rondas').select('*').eq('id', roundId).maybeSingle();
      if (actual?.estado === 'retirada') {
        return res.status(200).json({
          ganancia: Number(actual.ganancia_final), multiplicador: Number(actual.multiplicador_actual), repetido: true,
        });
      }
      return res.status(409).json({ error: 'Otra operación ya actualizó esta partida — no se procesó el retiro.' });
    }

    let saldoFinal = null;
    if (ganancia > 0) {
      const trasPremiar = await premiar(token, roundId, ganancia);
      saldoFinal = Number(trasPremiar.balance);
      if (!Number.isFinite(saldoFinal)) {
        throw new Error('Win777 no devolvió un saldo válido después del retiro');
      }
    }

    return res.status(200).json({
      ganancia, multiplicador: mult, saldo: saldoFinal,
      posicionesMina: ronda.posiciones_mina, repetido: false,
    });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'No se pudo retirar' });
  }
}
