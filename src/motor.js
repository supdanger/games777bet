// Mismo cálculo que usa Win777 en su motor real (analizarConfig):
// recorre las combinaciones posibles pesando cada una por su
// probabilidad, sin necesidad de simular miles de giros.
export function analizar(simbolos) {
  const total = simbolos.reduce((a, s) => a + s.peso, 0) || 1;
  const prob = (s) => s.peso / total;

  let ev = 0, ev2 = 0, hits = 0;

  for (const a of simbolos) {
    for (const b of simbolos) {
      for (const c of simbolos) {
        const p = prob(a) * prob(b) * prob(c);
        const linea = [a, b, c];
        const reales = linea.filter((s) => s.nombre !== 'wild');
        const candidato = reales.length ? reales[0] : linea[0];

        let pago = 0;
        if (linea.every((s) => s === candidato || s.nombre === 'wild')) {
          pago = (reales.length ? candidato : linea[0]).pago_tres;
        } else if (a === b || (a.nombre === 'wild' && b.nombre !== 'wild') || (b.nombre === 'wild' && a.nombre !== 'wild')) {
          pago = (a.nombre === 'wild' ? b : a).pago_dos || 0;
        }

        ev += p * pago;
        ev2 += p * pago * pago;
        if (pago > 0) hits += p;
      }
    }
  }

  return {
    rtp: ev * 100,
    volatilidad: Math.sqrt(Math.max(ev2 - ev * ev, 0)),
    frecuencia: hits > 0 ? 1 / hits : null,
    premioMayor: Math.max(0, ...simbolos.map((s) => s.pago_tres)),
  };
}
