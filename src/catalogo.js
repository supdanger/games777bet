import { supabase } from './supabase.js';
import { renderPreview } from './preview.js';

/**
 * Catálogo: los juegos marcados "listo", con su portada — para
 * verlos como se van a ver en una lista de verdad, y probarlos
 * desde ahí mismo, no solo desde el editor de cada uno.
 */
export function renderCatalogo(cont) {
  if (cont.innerHTML) { cont.innerHTML = ''; return; }

  cont.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <strong style="font-size:15px">Catálogo</strong>
      <p class="hint" style="margin-bottom:14px">Los juegos marcados como "Listo". Así se verían en una lista real.</p>
      <div id="ct-grilla" style="display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:12px"></div>
    </div>
  `;

  const cargar = async () => {
    const grillaEl = cont.querySelector('#ct-grilla');

    const [{ data: juegos, error }] = await Promise.all([
      supabase.from('juegos').select('*').eq('estado', 'listo').order('nombre'),
    ]);

    if (error) { grillaEl.innerHTML = `<p class="hint error">${error.message}</p>`; return; }

    if (!juegos?.length) {
      grillaEl.innerHTML = '<p class="hint">Todavía no tenés ningún juego marcado como "Listo".</p>';
      return;
    }

    grillaEl.innerHTML = juegos.map((j) => `
      <button data-id="${j.id}" style="padding:0; overflow:hidden; text-align:left; display:block">
        <div style="aspect-ratio:1; background:${j.portada_url ? `center/cover url('${j.portada_url}')` : 'var(--surface-alt)'}; display:flex; align-items:center; justify-content:center">
          ${j.portada_url ? '' : '<span class="hint" style="font-size:11px">Sin portada</span>'}
        </div>
        <p style="margin:8px 10px; font-size:13px; font-weight:500">${escapeHtml(j.nombre)}</p>
      </button>
    `).join('');

    grillaEl.querySelectorAll('[data-id]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const juego = juegos.find((j) => j.id === btn.dataset.id);

        const [{ data: simbolos }, { data: sonidos }, { data: efectos }] = await Promise.all([
          supabase.from('simbolos').select('*').eq('juego_id', juego.id).order('orden'),
          supabase.from('sonidos').select('*').eq('juego_id', juego.id),
          supabase.from('efectos').select('*').eq('juego_id', juego.id),
        ]);

        renderPreview({ juego, simbolos: simbolos || [], sonidos: sonidos || [], efectos: efectos || [] });
      });
    });
  };

  cargar();
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
