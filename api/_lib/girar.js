// Misma lógica que girar()/elegirSimbolo() en src/preview.js — acá
// es la que corre de verdad (con plata real), la del editor es solo
// para probar. Si algún día cambia una, cambiar la otra a mano.

export function elegirSimbolo(simbolos, total) {
  let r = Math.random() * total;
  for (const s of simbolos) { r -= s.peso; if (r <= 0) return s; }
  return simbolos[simbolos.length - 1];
}

// La grilla se arma columna por columna: grilla[col] son los 3
// símbolos verticales de ESE rodillo (arriba/medio/abajo). La línea
// de pago cruza los tres rodillos por la fila del medio.
export function girar(simbolos) {
  const total = simbolos.reduce((a, s) => a + s.peso, 0) || 1;
  const grilla = [];
  for (let c = 0; c < 3; c++) {
    grilla.push([elegirSimbolo(simbolos, total), elegirSimbolo(simbolos, total), elegirSimbolo(simbolos, total)]);
  }

  const FILA_PAGO = 1;
  const linea = [grilla[0][FILA_PAGO], grilla[1][FILA_PAGO], grilla[2][FILA_PAGO]];

  const reales = linea.filter((s) => s.nombre !== 'wild');
  const cand = reales.length ? reales[0] : linea[0];

  let premio = 0, nivel = null;
  if (linea.every((s) => s === cand || s.nombre === 'wild')) {
    premio = (reales.length ? cand : linea[0]).pago_tres;
    nivel = premio >= Math.max(...simbolos.map((s) => s.pago_tres)) ? 'premio_mayor' : 'tres_iguales';
  } else if (linea[0] === linea[1] || (linea[0].nombre === 'wild' || linea[1].nombre === 'wild')) {
    premio = (linea[0].nombre === 'wild' ? linea[1] : linea[0]).pago_dos || 0;
    if (premio > 0) nivel = 'dos_iguales';
  }
  return { grilla, premio, nivel, filaPago: FILA_PAGO };
}
