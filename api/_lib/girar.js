// =========================================================
// LÓGICA REAL DEL GIRO
// =========================================================

export function elegirSimbolo(simbolos, total) {
  let r = Math.random() * total;

  for (const s of simbolos) {
    r -= Number(s.peso) || 0;

    if (r <= 0) {
      return s;
    }
  }

  return simbolos[simbolos.length - 1];
}


// La grilla se arma columna por columna.
// grilla[col] = [arriba, medio, abajo]
//
// La línea de pago utiliza únicamente la fila del medio.
//
// IMPORTANTE:
// - 2 iguales: se buscan dos símbolos iguales en toda la línea.
// - 3 iguales: los tres deben ser iguales.
// - WILD puede sustituir a un símbolo.
// - El frontend recibe también los símbolos ganadores para
//   poder resaltarlos correctamente.
// =========================================================

export function girar(simbolos) {
  const total = simbolos.reduce(
    (acumulado, simbolo) => acumulado + (Number(simbolo.peso) || 0),
    0
  ) || 1;

  const grilla = [];

  // Generar los 3 rodillos
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

  const esWild = (simbolo) =>
    simbolo?.nombre?.toLowerCase() === 'wild';

  const reales = linea.filter((simbolo) => !esWild(simbolo));

  let premio = 0;
  let nivel = null;
  let simbolosGanadores = [];

  // =========================================================
  // 1. PREMIO MAYOR / TRES IGUALES
  // =========================================================

  if (reales.length > 0) {
    const simboloBase = reales[0];

    const todosCoinciden = reales.every(
      (simbolo) => simbolo.nombre === simboloBase.nombre
    );

    if (todosCoinciden && reales.length === 3) {
      premio = Number(simboloBase.pago_tres) || 0;

      const premioMayor = Math.max(
        0,
        ...simbolos.map((simbolo) => Number(simbolo.pago_tres) || 0)
      );

      nivel =
        premio > 0 && premio >= premioMayor
          ? 'premio_mayor'
          : 'tres_iguales';

      simbolosGanadores = [0, 1, 2];
    }

    // 3 posiciones, pero una o dos son WILD.
    else if (reales.length >= 1) {
      const todosMismoSimbolo = reales.every(
        (simbolo) => simbolo.nombre === simboloBase.nombre
      );

      if (todosMismoSimbolo) {
        premio = Number(simboloBase.pago_tres) || 0;

        const premioMayor = Math.max(
          0,
          ...simbolos.map((simbolo) => Number(simbolo.pago_tres) || 0)
        );

        nivel =
          premio > 0 && premio >= premioMayor
            ? 'premio_mayor'
            : 'tres_iguales';

        simbolosGanadores = linea.map(() => true);
      }
    }
  }

  // =========================================================
  // 2. DOS IGUALES
  // =========================================================

  if (!nivel) {
    const candidatos = {};

    linea.forEach((simbolo, indice) => {
      if (!esWild(simbolo)) {
        const nombre = simbolo.nombre;

        if (!candidatos[nombre]) {
          candidatos[nombre] = [];
        }

        candidatos[nombre].push(indice);
      }
    });

    let pareja = null;

    for (const nombre of Object.keys(candidatos)) {
      if (candidatos[nombre].length >= 2) {
        pareja = candidatos[nombre].slice(0, 2);
        break;
      }
    }

    // Un símbolo + WILD también puede formar pareja.
    if (!pareja) {
      const indiceWild = linea.findIndex((simbolo) => esWild(simbolo));

      if (indiceWild !== -1) {
        const indiceReal = linea.findIndex(
          (simbolo, indice) =>
            !esWild(simbolo) && indice !== indiceWild
        );

        if (indiceReal !== -1) {
          pareja = [indiceReal, indiceWild];
        }
      }
    }

    if (pareja) {
      const indiceReal = pareja.find(
        (indice) => !esWild(linea[indice])
      );

      const simbolo = linea[indiceReal];

      premio = Number(simbolo?.pago_dos) || 0;

      if (premio > 0) {
        nivel = 'dos_iguales';
        simbolosGanadores = pareja;
      }
    }
  }

  // =========================================================
  // 3. NORMALIZACIÓN FINAL
  // =========================================================

  premio = Number.isFinite(Number(premio))
    ? Number(premio)
    : 0;

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