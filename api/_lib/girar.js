// =========================================================
// LÓGICA REAL DEL GIRO
//
// Regla de pago (estándar de slots, de izquierda a derecha):
//   - TRES IGUALES: los tres rodillos coinciden.
//   - DOS IGUALES: SOLO los rodillos 1 y 2 (izquierda y centro).
//     Dos iguales en los rodillos 2-3 NO pagan. Esto no es un
//     detalle estético: el RTP del juego está calibrado con esta
//     regla, y pagar pares en cualquier posición lo dispara muy por
//     encima de lo configurado.
//   - WILD sustituye a cualquier símbolo.
//
// El frontend recibe simbolosGanadores (los índices de la línea que
// pagaron) para remarcar exactamente esas celdas y ninguna otra.
// =========================================================

export function elegirSimbolo(simbolos, total) {
  let r = Math.random() * total;

  for (const s of simbolos) {
    r -= Number(s.peso) || 0;
    if (r <= 0) return s;
  }

  return simbolos[simbolos.length - 1];
}

export function girar(simbolos) {
  const total = simbolos.reduce(
    (acumulado, simbolo) => acumulado + (Number(simbolo.peso) || 0),
    0
  ) || 1;

  const grilla = [];

  for (let columna = 0; columna < 3; columna++) {
    grilla.push([
      elegirSimbolo(simbolos, total),
      elegirSimbolo(simbolos, total),
      elegirSimbolo(simbolos, total),
    ]);
  }

  const FILA_PAGO = 1;

  const linea = [
    grilla[0][FILA_PAGO],
    grilla[1][FILA_PAGO],
    grilla[2][FILA_PAGO],
  ];

  const esWild = (simbolo) => simbolo?.nombre?.toLowerCase() === 'wild';

  // Dos símbolos "coinciden" si son el mismo, o si alguno es wild.
  const coinciden = (a, b) =>
    esWild(a) || esWild(b) || a?.nombre === b?.nombre;

  const premioMayorDelJuego = Math.max(
    0,
    ...simbolos.map((simbolo) => Number(simbolo.pago_tres) || 0)
  );

  let premio = 0;
  let nivel = null;
  let simbolosGanadores = [];

  // =========================================================
  // 1. TRES IGUALES (los tres rodillos, con wild sustituyendo)
  // =========================================================

  const reales = linea.filter((simbolo) => !esWild(simbolo));

  // Si hay wilds, el símbolo que define el premio es el primer real
  // de la línea. Si son los tres wild, paga el propio wild.
  const simboloBase = reales.length > 0 ? reales[0] : linea[0];

  const todosCoinciden = reales.every(
    (simbolo) => simbolo.nombre === simboloBase.nombre
  );

  if (todosCoinciden) {
    premio = Number(simboloBase.pago_tres) || 0;

    if (premio > 0) {
      nivel = premio >= premioMayorDelJuego ? 'premio_mayor' : 'tres_iguales';
      simbolosGanadores = [0, 1, 2];
    }
  }

  // =========================================================
  // 2. DOS IGUALES — ÚNICAMENTE rodillos 1 y 2
  // =========================================================

  if (!nivel && coinciden(linea[0], linea[1])) {
    // Si el primero es wild, el que define el pago es el segundo.
    const simboloPago = esWild(linea[0]) ? linea[1] : linea[0];

    premio = Number(simboloPago?.pago_dos) || 0;

    if (premio > 0) {
      nivel = 'dos_iguales';
      simbolosGanadores = [0, 1];
    }
  }

  // =========================================================
  // 3. NORMALIZACIÓN FINAL
  // =========================================================

  premio = Number.isFinite(Number(premio)) ? Number(premio) : 0;

  if (premio <= 0) {
    premio = 0;
    nivel = null;
    simbolosGanadores = [];
  }

  return {
    grilla,
    premio,
    nivel,
    filaPago: FILA_PAGO,
    simbolosGanadores,
  };
}