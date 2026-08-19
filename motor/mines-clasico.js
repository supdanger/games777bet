// =========================================================
// MOTOR "mines-clasico" — grilla de 25 casillas (5x5 fija), el
// jugador elige cuántas minas, retiro habilitado cada 5 aciertos.
//
// A diferencia de los motores de tragamonedas, acá no hay símbolos
// con peso ni un solo "girar()" que resuelve todo de una — es una
// PARTIDA de varios pasos: el jugador destapa una casilla por vez, y
// el servidor tiene que acordarse de dónde están las minas entre un
// paso y el siguiente. Por eso la "fuente de verdad" no es una
// función que se llama una vez, sino la fila de mines_rondas en la
// base — este archivo solo tiene la matemática pura, sin estado.
// =========================================================

export const TIPO = 'grilla_revelar';
export const TOTAL_CASILLAS = 25;      // grilla fija 5x5, no configurable por juego
export const RETIRO_CADA = 5;          // el retiro se habilita cada 5 aciertos

export function minasValidas(minas) {
  return Number.isInteger(minas) && minas >= 1 && minas <= TOTAL_CASILLAS - 1;
}

// Entero al azar en [0, max) usando crypto.getRandomValues, no
// Math.random(): con plata real de por medio, la posición de las
// minas tiene que salir de un generador criptográficamente seguro,
// no de uno pensado para juegos y animaciones sin apuesta.
//
// Se usa crypto.getRandomValues (el estándar web) y no
// node:crypto — así este archivo sigue siendo el mismo tanto del
// lado del servidor como del navegador, sin ningún import
// específico de Node, igual que los motores de slot.
//
// El descarte de valores fuera de "limite" evita el sesgo típico de
// "% max": sin él, los números bajos saldrían levemente más
// seguido que los altos.
function enteroSeguro(max) {
  const limite = Math.floor(0xFFFFFFFF / max) * max;
  const buf = new Uint32Array(1);
  let val;
  do {
    crypto.getRandomValues(buf);
    val = buf[0];
  } while (val >= limite);
  return val % max;
}

// Coloca las minas al azar en la grilla (Fisher-Yates). Se llama
// SIEMPRE del lado del servidor — el cliente nunca conoce estas
// posiciones hasta que la ronda termina (gana o pierde).
export function colocarMinas(minas) {
  const posiciones = Array.from({ length: TOTAL_CASILLAS }, (_, i) => i);
  for (let i = posiciones.length - 1; i > 0; i--) {
    const j = enteroSeguro(i + 1);
    [posiciones[i], posiciones[j]] = [posiciones[j], posiciones[i]];
  }
  return posiciones.slice(0, minas).sort((a, b) => a - b);
}

// Multiplicador "justo" (0% margen) tras "aciertos" casillas seguras
// reveladas seguidas: la inversa de la probabilidad de haber llegado
// hasta acá sin pisar ninguna mina. Es la misma cuenta que hace
// cualquier casino real de este tipo de juego — no es una
// aproximación.
function multiplicadorJusto(minas, aciertos) {
  let prob = 1;
  for (let i = 0; i < aciertos; i++) {
    prob *= (TOTAL_CASILLAS - minas - i) / (TOTAL_CASILLAS - i);
  }
  return 1 / prob;
}

// El multiplicador real aplica el margen de la casa de ESTE juego
// (viene de juego.mines_margen_pct, configurable como la apuesta
// mín/máx) como un único factor — así el RTP queda exacto sea cual
// sea la cantidad de minas que eligió el jugador, sin calibrar nada
// a mano como hace falta en los slots.
export function multiplicador(minas, aciertos, margenCasa) {
  if (aciertos <= 0) return 1;
  return multiplicadorJusto(minas, aciertos) * (1 - margenCasa);
}

// El retiro se habilita en los puntos fijos (cada RETIRO_CADA
// aciertos) Y siempre al completar todas las casillas seguras
// posibles. Ese segundo caso importa: con muchas minas elegidas, el
// jugador puede vaciar el tablero entero sin pasar nunca por un
// múltiplo de 5 — sin este caso, se quedaría sin poder cobrar un
// tablero que ya terminó de limpiar.
export function puedeRetirar(minas, aciertos) {
  if (aciertos <= 0) return false;
  const segurasTotales = TOTAL_CASILLAS - minas;
  if (aciertos >= segurasTotales) return true;
  return aciertos % RETIRO_CADA === 0;
}

/**
 * Simula partidas REALES (usa colocarMinas/multiplicador/
 * puedeRetirar, las mismas funciones del juego de verdad) para
 * confirmar de forma empírica que el RTP converge al margen
 * configurado sin importar en qué punto se retire el jugador — no
 * alcanza con creer que la fórmula es correcta, hay que jugarla
 * muchas veces y medir.
 *
 * "retirarEn" es la estrategia simulada: el jugador intenta
 * retirarse apenas llega a esa cantidad de aciertos (y si ese número
 * no cae justo en un punto de retiro habilitado, sigue hasta el
 * próximo válido — igual que en el juego real).
 */
export function simularMines({ partidas, minas, margenCasa, retirarEn }) {
  const apuesta = 1; // unidad — el RTP no depende del monto apostado
  let apostado = 0, pagado = 0, perdidas = 0, retiros = 0;
  let sumaAciertos = 0, multiplicadorMaximo = 0;

  for (let i = 0; i < partidas; i++) {
    // Dos mezclados INDEPENDIENTES a propósito: uno decide dónde
    // están las minas, el otro decide en qué orden el jugador
    // simulado las va destapando. Usar el mismo mezclado para las
    // dos cosas hace que la primera casilla revelada sea siempre una
    // mina (quedó así en un primer intento y se corrigió acá).
    const posiciones = Array.from({ length: TOTAL_CASILLAS }, (_, i) => i);
    for (let k = posiciones.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      [posiciones[k], posiciones[j]] = [posiciones[j], posiciones[k]];
    }
    const minasPos = new Set(posiciones.slice(0, minas));

    const orden = Array.from({ length: TOTAL_CASILLAS }, (_, i) => i);
    for (let k = orden.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      [orden[k], orden[j]] = [orden[j], orden[k]];
    }
    apostado += apuesta;

    const segurasTotales = TOTAL_CASILLAS - minas;
    let aciertos = 0;
    let perdio = false;
    for (const casilla of orden) {
      if (minasPos.has(casilla)) { perdio = true; break; }
      aciertos++;
      // Se corta apenas se puede retirar Y ya se llegó al objetivo
      // de la estrategia, o al limpiar el tablero entero — mismo
      // límite que ahora exige el servidor real, un jugador no puede
      // seguir tocando después de eso.
      if (aciertos >= segurasTotales) break;
      if (aciertos >= retirarEn && puedeRetirar(minas, aciertos)) break;
    }

    sumaAciertos += aciertos;
    if (perdio) {
      perdidas++;
    } else {
      retiros++;
      const mult = multiplicador(minas, aciertos, margenCasa);
      pagado += apuesta * mult;
      if (mult > multiplicadorMaximo) multiplicadorMaximo = mult;
    }
  }

  return {
    partidas, apostado, pagado,
    rtp: (pagado / apostado) * 100,
    houseEdge: (1 - pagado / apostado) * 100,
    perdidas, retiros,
    promedioAciertos: sumaAciertos / partidas,
    multiplicadorMaximo,
  };
}
