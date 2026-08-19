// =========================================================
// MOTOR "clasico-5x3" — 5 rodillos, 1 línea de pago, wild.
//
// Mismo criterio que clasico-3x3.js, generalizado: paga la cadena de
// símbolos iguales MÁS LARGA que arranca en el primer rodillo (de
// izquierda a derecha), con el wild sustituyendo a cualquier símbolo.
// Con 3 rodillos esa cadena podía ser de 2 o de 3; acá puede ser de
// 2, 3, 4 o 5 — por eso los símbolos suman pago_cuatro y pago_cinco
// (SQL 31), que en el 3x3 no existen y quedan en NULL.
//
// ÚNICA fuente de verdad del resultado para los juegos que elijan
// este motor — la importan tanto el servidor (con plata real) como
// la vista previa y el simulador de RTP del ensamblador, a través de
// motor/registro.js. No se toca clasico-3x3.js para nada de esto.
// =========================================================

export const COLUMNAS = 5;
export const FILAS = 3;
export const FILA_PAGO = 1; // la fila del medio, igual que el 3x3

export function elegirSimbolo(simbolos, total) {
  let r = Math.random() * total;
  for (const s of simbolos) { r -= s.peso; if (r <= 0) return s; }
  return simbolos[simbolos.length - 1];
}

// La grilla se arma columna por columna: grilla[col] son los 3
// símbolos verticales de ESE rodillo. La línea de pago cruza los 5
// rodillos por la fila del medio.
export function girar(simbolos) {
  const total = simbolos.reduce((a, s) => a + s.peso, 0) || 1;
  const grilla = [];
  for (let c = 0; c < COLUMNAS; c++) {
    grilla.push([
      elegirSimbolo(simbolos, total),
      elegirSimbolo(simbolos, total),
      elegirSimbolo(simbolos, total),
    ]);
  }

  const linea = grilla.map((col) => col[FILA_PAGO]);
  const esWild = (s) => s.nombre === 'wild';

  // El símbolo que define el pago es el primero de la línea que NO
  // es wild — si son todos wild, paga el wild mismo (caso raro, pero
  // tiene que resolver a algo).
  const base = linea.find((s) => !esWild(s)) || linea[0];

  // Cuenta cuántas posiciones seguidas, arrancando en la primera,
  // coinciden con "base" (wild cuenta como cualquiera). Corta en la
  // primera que no coincide — no busca coincidencias salteadas.
  let cadena = 0;
  for (const s of linea) {
    if (s === base || esWild(s) || esWild(base)) cadena++;
    else break;
  }

  const CAMPO_PAGO = { 2: 'pago_dos', 3: 'pago_tres', 4: 'pago_cuatro', 5: 'pago_cinco' };
  let premio = 0;
  let nivel = null;
  let simbolosGanadores = [];

  if (cadena >= 2) {
    const campo = CAMPO_PAGO[cadena];
    premio = Number(base[campo]) || 0;
    if (premio > 0) {
      const premioMayorDelJuego = Math.max(0, ...simbolos.map((s) => Number(s.pago_cinco) || 0));
      simbolosGanadores = Array.from({ length: cadena }, (_, i) => i);
      if (cadena === COLUMNAS) {
        nivel = premio >= premioMayorDelJuego ? 'premio_mayor' : 'tres_iguales';
      } else if (cadena >= 3) {
        nivel = 'tres_iguales';
      } else {
        nivel = 'dos_iguales';
      }
    }
  }

  return { grilla, premio, nivel, filaPago: FILA_PAGO, simbolosGanadores };
}
