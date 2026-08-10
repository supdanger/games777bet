import { supabase } from './supabase.js';

/** Panel de clientes conectados (los casinos a los que servís
 * juegos). Se abre/cierra como acordeón, igual que "Proveedores
 * externos" en el panel de Win777. */
export function renderClientes(cont) {
  if (cont.innerHTML) { cont.innerHTML = ''; return; }

  cont.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <strong style="font-size:15px">Clientes conectados</strong>
      <p class="hint" style="margin-bottom:14px">Los casinos a los que les servís juegos. La URL y el secreto son los que te dio SU panel al crear el proveedor de ese lado.</p>

      <div id="cl-lista"><p class="hint">Cargando...</p></div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:14px">
        <input id="cl-nombre" placeholder="Nombre (ej: Win777)" />
        <input id="cl-url" placeholder="https://win777bet-panel.vercel.app" />
      </div>
      <input id="cl-secreto" placeholder="Secreto que te dio el panel del cliente" style="margin-top:8px" />
      <button class="primary" id="cl-crear" style="margin-top:10px">Agregar cliente</button>
      <div id="cl-msg"></div>
    </div>
  `;

  const cargarLista = async () => {
    const listaEl = cont.querySelector('#cl-lista');
    const { data, error } = await supabase.from('clientes_conectados').select('*').order('created_at', { ascending: false });

    if (error) { listaEl.innerHTML = `<p class="hint error">${error.message}</p>`; return; }

    listaEl.innerHTML = data?.length ? data.map((c) => `
      <div style="display:flex; align-items:center; gap:8px; background:var(--surface-alt); border-radius:8px; padding:8px 10px; margin-bottom:6px">
        <div style="flex:1; min-width:0">
          <strong style="font-size:13px">${escapeHtml(c.nombre)}</strong>
          <p class="hint" style="margin:2px 0 0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${escapeHtml(c.panel_url)}</p>
        </div>
        <span class="badge ${c.activo ? 'listo' : 'borrador'}">${c.activo ? 'Activo' : 'Deshabilitado'}</span>
        <button data-toggle="${c.id}" data-activo="${c.activo}">${c.activo ? 'Deshabilitar' : 'Habilitar'}</button>
      </div>
    `).join('') : '<p class="hint">Todavía no conectaste ningún cliente.</p>';

    listaEl.querySelectorAll('[data-toggle]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await supabase.from('clientes_conectados').update({ activo: btn.dataset.activo !== 'true' }).eq('id', btn.dataset.toggle);
        cargarLista();
      });
    });
  };

  cont.querySelector('#cl-crear').addEventListener('click', async () => {
    const nombre = cont.querySelector('#cl-nombre').value.trim();
    const url = cont.querySelector('#cl-url').value.trim();
    const secreto = cont.querySelector('#cl-secreto').value.trim();
    const msgEl = cont.querySelector('#cl-msg');

    if (!nombre || !url || !secreto) {
      msgEl.innerHTML = '<p class="hint error">Completá los tres campos.</p>';
      return;
    }

    const { error } = await supabase.from('clientes_conectados').insert({ nombre, panel_url: url, secreto });

    if (error) { msgEl.innerHTML = `<p class="hint error">${error.message}</p>`; return; }

    cont.querySelector('#cl-nombre').value = '';
    cont.querySelector('#cl-url').value = '';
    cont.querySelector('#cl-secreto').value = '';
    msgEl.innerHTML = '<p class="hint" style="color:var(--ok)">Cliente agregado.</p>';
    cargarLista();
  });

  cargarLista();
}

/** Trae la lista de clientes activos, para marcar a cuáles está
 * conectado un juego puntual. */
export async function listarClientesActivos() {
  const { data } = await supabase.from('clientes_conectados').select('id, nombre').eq('activo', true).order('nombre');
  return data || [];
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
