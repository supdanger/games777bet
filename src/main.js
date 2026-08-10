import './styles.css';
import { supabase } from './supabase.js';
import { renderLogin } from './login.js';
import { renderApp } from './app.js';

const raiz = document.getElementById('app');

async function arrancar() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    renderLogin(raiz, arrancar);
    return;
  }

  renderApp(raiz, session, () => {
    supabase.auth.signOut().then(arrancar);
  });
}

// Si la sesión cambia en otra pestaña, reflejarlo acá también.
supabase.auth.onAuthStateChange(() => arrancar());

arrancar();
