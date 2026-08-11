import { createClient } from '@supabase/supabase-js';

// Este cliente usa la Service Role Key: bypassea RLS. SOLO se
// importa desde archivos de /api (servidor) — nunca debe llegar al
// bundle del navegador. La URL reusa la misma variable que ya usa
// el frontend; la key es nueva, server-only, sin prefijo VITE_.
export const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
