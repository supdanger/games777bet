import { consultarBalance } from './_lib/proveedorCliente.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  const token = req.query.token;
  if (!token) return res.status(400).json({ error: 'Falta el token' });

  try {
    const data = await consultarBalance(token);
    return res.status(200).json({ saldo: Number(data.balance) });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'No se pudo consultar el saldo' });
  }
}
