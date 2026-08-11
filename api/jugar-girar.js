const resultado = girar(simbolos);

const ganancia = Number(
  (Number(resultado.premio || 0) * monto).toFixed(2)
);

let saldoFinal;

if (ganancia > 0) {
  const premioRes = await premiar(
    token,
    clientId,
    ganancia
  );

  saldoFinal = Number(premioRes.balance);

  if (!Number.isFinite(saldoFinal)) {
    throw new Error(
      'Win777 no devolvió un saldo válido después del premio'
    );
  }
} else {
  saldoFinal = Number(trasApostar.balance);
}

const respuesta = {
  grilla: resultado.grilla,
  premio: ganancia,
  nivel: resultado.nivel,
  filaPago: resultado.filaPago,
  simbolosGanadores: resultado.simbolosGanadores,
  saldo: saldoFinal,
  repetido: false,
};

console.log('[GIRO RESUELTO]', {
  clientId,
  apuesta: monto,
  premio: ganancia,
  nivel: resultado.nivel,
  saldo: saldoFinal,
});

supabaseAdmin
  .from('rondas_jugadas')
  .insert({
    juego_id: juego.id,
    client_id: clientId,
    apuesta: monto,
    premio: ganancia,
    nivel_premio: resultado.nivel,
    grilla: resultado.grilla,
    saldo_despues: saldoFinal,
  })
  .then(({ error }) => {
    if (error) {
      console.error(
        'No se pudo registrar la ronda:',
        error.message
      );
    }
  });

return res.status(200).json(respuesta);