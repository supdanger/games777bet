import './styles.css';
import { supabase } from './supabase.js';
import { renderLogin } from './login.js';
import { renderApp } from './app.js';

const raiz = document.getElementById('app');

// Quién está logueado ahora mismo. Sirve para distinguir un cambio
// real de sesión de un simple aviso de Supabase.
let usuarioActual = null;

async function arrancar() {
  const { data: { session } } = await supabase.auth.getSession();
  usuarioActual = session?.user?.id ?? null;

  if (!session) {
    renderLogin(raiz, arrancar);
    return;
  }

  renderApp(raiz, session, () => {
    supabase.auth.signOut().then(arrancar);
  });
}

// OJO: onAuthStateChange NO avisa solamente cuando entrás o salís.
// También salta cuando Supabase renueva el token por su cuenta (cada
// tanto, en segundo plano) y cuando volvés a esta pestaña después de
// estar en otra. Antes, cada uno de esos avisos redibujaba la app
// entera: en el medio de acomodar capas, se perdía lo que estabas
// haciendo y parecía que la página se refrescaba sola.
//
// Ahora solo se redibuja si CAMBIÓ el usuario (entró otro, o se
// cerró la sesión). Una renovación de token del mismo usuario no
// toca nada de lo que tenés abierto.
supabase.auth.onAuthStateChange((evento, session) => {
  const nuevoUsuario = session?.user?.id ?? null;
  if (nuevoUsuario === usuarioActual) return;
  usuarioActual = nuevoUsuario;
  arrancar();
});

arrancar();
