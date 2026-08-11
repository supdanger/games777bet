import crypto from 'node:crypto';

// Llama a /api/proveedor del panel de Win777, firmando cada pedido
// con el secreto que nos dieron al darnos de alta como proveedor.
// El secreto vive SOLO acá (variables de entorno del servidor) —
// nunca en el navegador del jugador. Mismo protocolo que describe
// deploy/integracion-proveedores.md del lado de ellos.

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function firmar(secreto, accion, token, monto, roundId, timestamp) {
  const texto = `${accion}|${token}|${monto ?? ''}|${roundId ?? ''}|${timestamp}`;
  return b64url(crypto.createHmac('sha256', secreto).update(texto).digest());
}

async function llamarProveedor(accion, { token, monto, roundId }) {
  const secreto = process.env.WIN777_PROVEEDOR_SECRETO;
  const base = process.env.WIN777_API_BASE;
  if (!secreto || !base) throw new Error('Falta configurar WIN777_PROVEEDOR_SECRETO o WIN777_API_BASE');

  const timestamp = Math.floor(Date.now() / 1000);
  const firma = firmar(secreto, accion, token, monto, roundId, timestamp);
  const esGet = accion === 'balance';

  const url = new URL('/api/proveedor', base);
  url.searchParams.set('accion', accion);
  if (esGet) url.searchParams.set('token', token);

  const res = await fetch(url, {
    method: esGet ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Timestamp': String(timestamp),
      'X-Firma': firma,
    },
    body: esGet ? undefined : JSON.stringify({ token, roundId, monto }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `El panel respondió ${res.status}`);
  return data;
}

export const consultarBalance = (token) => llamarProveedor('balance', { token });
export const apostar = (token, roundId, monto) => llamarProveedor('apostar', { token, roundId, monto });
export const premiar = (token, roundId, monto) => llamarProveedor('premiar', { token, roundId, monto });
