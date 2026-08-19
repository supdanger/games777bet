// Mismo cálculo que usan los motores reales: recorre las
// combinaciones posibles pesando cada una por su probabilidad, sin
// necesidad de simular miles de giros. Generalizado a cualquier
// cantidad de rodillos (3 para clasico-3x3, 5 para clasico-5x3, lo
// que venga después) — la regla es la misma en todos: paga la
// cadena más larga que arranca en el primer rodillo, el wild
// sustituye a cualquiera. No usa Math.random en ningún lado: es
// exacto, no una simulación.
const CAMPO_PAGO = { 2: 'pago_dos', 3: 'pago_tres', 4: 'pago_cuatro', 5: 'pago_cinco' };

function pagoDeLinea(linea) {
  const esWild = (s) => s.nombre === 'wild';
  const base = linea.find((s) => !esWild(s)) || linea[0];
  let cadena = 0;
  for (const s of linea) {
    if (s === base || esWild(s) || esWild(base)) cadena++;
    else break;
  }
  if (cadena < 2) return 0;
  return Number(base[CAMPO_PAGO[cadena]]) || 0;
}

export function analizar(simbolos, columnas = 3) {
  const total = simbolos.reduce((a, s) => a + s.peso, 0) || 1;
  const prob = (s) => s.peso / total;

  let ev = 0, ev2 = 0, hits = 0;

  // Recorre TODAS las combinaciones posibles de "columnas" símbolos
  // — 8^3=512 para el 3x3, 8^5≈32.768 para el 5x3. Rápido en los dos
  // casos, sin necesidad de una aproximación.
  const recorrer = (linea, p) => {
    if (linea.length === columnas) {
      const pago = pagoDeLinea(linea);
      ev += p * pago;
      ev2 += p * pago * pago;
      if (pago > 0) hits += p;
      return;
    }
    for (const s of simbolos) recorrer([...linea, s], p * prob(s));
  };
  recorrer([], 1);

  return {
    rtp: ev * 100,
    volatilidad: Math.sqrt(Math.max(ev2 - ev * ev, 0)),
    frecuencia: hits > 0 ? 1 / hits : null,
    premioMayor: Math.max(0, ...simbolos.map((s) => Number(s[CAMPO_PAGO[columnas]]) || 0)),
  };
}
