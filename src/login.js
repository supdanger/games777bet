import { supabase } from './supabase.js';

export function renderLogin(raiz, onEntrar) {
  raiz.innerHTML = `
    <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px">
      <div class="card" style="max-width:340px; width:100%">
        <h2 style="margin-top:0">gameswin777</h2>
        <p class="hint" style="margin-bottom:16px">Ensamblador de juegos. Acceso solo para vos.</p>

        <label>Email
          <input id="lg-email" type="email" autocomplete="username" />
        </label>
        <label style="display:block; margin-top:10px">Contraseña
          <input id="lg-pass" type="password" autocomplete="current-password" />
        </label>

        <button class="primary" id="lg-entrar" style="width:100%; margin-top:16px">Entrar</button>
        <p id="lg-msg" class="hint"></p>
      </div>
    </div>
  `;

  const entrar = async () => {
    const email = raiz.querySelector('#lg-email').value.trim();
    const password = raiz.querySelector('#lg-pass').value;
    const msgEl = raiz.querySelector('#lg-msg');
    const btn = raiz.querySelector('#lg-entrar');

    if (!email || !password) {
      msgEl.className = 'hint error';
      msgEl.textContent = 'Completá email y contraseña.';
      return;
    }

    btn.disabled = true;
    msgEl.className = 'hint';
    msgEl.textContent = 'Entrando...';

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    btn.disabled = false;

    if (error) {
      msgEl.className = 'hint error';
      msgEl.textContent = 'Email o contraseña incorrectos.';
      return;
    }

    onEntrar();
  };

  raiz.querySelector('#lg-entrar').addEventListener('click', entrar);
  raiz.querySelector('#lg-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') entrar(); });
}
