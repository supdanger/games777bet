// =========================================================
// ANIMACIONES CON LOTTIE
//
// Compartido entre el ensamblador (preview.js) y la pantalla real del
// jugador (jugar.js) — misma decisión que el motor unificado y las
// luces: una sola copia, para que no se desincronicen.
//
// Reemplaza a Rive (que dejó de permitir exportar el .riv en el plan
// gratuito). Diferencia clave de diseño: Lottie no tiene disparadores
// con nombre — es un reproductor lineal que avisa con un evento
// "complete" cuando termina. Eso simplifica bastante todo esto.
//
// Alcance, igual que antes:
//   - Símbolos: solo sobre celdas YA FRENADAS que ganaron, nunca
//     durante el relleno del giro. Dos archivos por símbolo (uno
//     para premio chico, otro para premio mayor) en vez de un
//     archivo con disparadores internos.
//   - Animaciones del juego: intro (antes de la carga), y las que
//     acompañan girar/premio chico/premio mayor, posicionables
//     libremente en la pantalla.
// =========================================================

let dotLottiePromise = null;
// La librería se carga recién la primera vez que hace falta: un
// juego sin animaciones no paga el costo de bajarla.
function cargarLottie() {
  if (!dotLottiePromise) dotLottiePromise = import('@lottiefiles/dotlottie-web');
  return dotLottiePromise;
}

// =========================================================
// Símbolos ganadores
// =========================================================

// celda del DOM -> { instancia, tope }
const instanciasSimbolo = new Map();

/**
 * Muestra la animación Lottie del símbolo ENCIMA de lo que ya hay en
 * la celda (sin borrarlo) y la reproduce una vez. Al terminar, saca
 * la animación y destapa exactamente lo que había — nunca reconstruye
 * ni le exige a quien llama que le pase el HTML de vuelta.
 *
 * Esto es a propósito: preview.js arma sus celdas reconstruyendo HTML
 * en cada giro, jugar.js las crea UNA sola vez al abrir el juego y
 * nunca las vuelve a tocar (por rendimiento). Tapar/destapar funciona
 * igual de bien con cualquiera de los dos, sin acoplarse a ninguno.
 *
 * Si el símbolo no tiene animación para ese nivel, no hace nada — la
 * celda se queda como estaba, como si esto no existiera.
 */
export async function animarSimboloGanador(celdaEl, simbolo, nivel) {
  const url = nivel === 'premio_mayor' ? simbolo?.lottie_grande_url : simbolo?.lottie_chico_url;
  if (!url) return;

  // Si esta celda ya tenía una animación corriendo (giro nuevo antes
  // de que termine la anterior), se corta primero — revertir() deja
  // todo destapado antes de tapar de nuevo.
  const previa = instanciasSimbolo.get(celdaEl);
  if (previa) previa.revertir();

  let DotLottie;
  try {
    ({ DotLottie } = await cargarLottie());
  } catch {
    return; // sin internet para bajar la librería: se queda como estaba
  }

  // Se tapa (display:none), nunca se borra — así lo que sea que haya
  // adentro (imágenes fijas o reconstruidas) sigue intacto debajo.
  const hijosPrevios = Array.from(celdaEl.children);
  hijosPrevios.forEach((el) => {
    el.dataset.lottieDisplayPrevio = el.style.display;
    el.style.display = 'none';
  });

  const canvas = document.createElement('canvas');
  canvas.width = celdaEl.clientWidth || 64;
  canvas.height = celdaEl.clientHeight || 64;
  canvas.style.cssText = 'width:100%; height:100%; display:block';
  celdaEl.appendChild(canvas);

  const revertir = () => {
    clearTimeout(tope);
    instancia.destroy();
    canvas.remove();
    hijosPrevios.forEach((el) => {
      el.style.display = el.dataset.lottieDisplayPrevio || '';
      delete el.dataset.lottieDisplayPrevio;
    });
    instanciasSimbolo.delete(celdaEl);
  };

  const instancia = new DotLottie({
    canvas, src: url, autoplay: true, loop: false,
    layout: { fit: 'contain' },
  });
  // El evento real de finalización manda; el setTimeout de abajo es
  // solo el respaldo de seguridad si por lo que sea nunca llega.
  instancia.addEventListener('complete', revertir);
  instancia.addEventListener('loadError', revertir);

  const tope = setTimeout(revertir, 4000);
  instanciasSimbolo.set(celdaEl, { revertir });
}

// Corta todas las animaciones de símbolo activas ya mismo — se usa
// al arrancar un giro nuevo o al cerrar la vista previa.
export function detenerAnimacionesSimbolos() {
  Array.from(instanciasSimbolo.values()).forEach(({ revertir }) => revertir());
  instanciasSimbolo.clear();
}

// =========================================================
// Animaciones del juego (intro / girar / premio)
// =========================================================

const ANCHO_ESC = 420, ALTO_ESC = 860;
const activasJuego = new Set(); // funciones "cortar" de cada una

/**
 * Muestra una animación del juego dentro de "contenedor", en la
 * posición y tamaño configurados, y la reproduce una vez.
 *
 * Si "alTerminar" viene dado, se llama cuando la animación termina —
 * así la intro puede encadenar con la pantalla de carga sin inventar
 * un tiempo fijo. Se limpia sola (canvas + instancia) apenas termina,
 * con un tope de seguridad por si el archivo nunca avisa.
 */
export async function mostrarAnimacionJuego(contenedor, cfg, alTerminar) {
  if (!cfg?.lottie_url) { alTerminar?.(); return () => {}; }

  let DotLottie;
  try {
    ({ DotLottie } = await cargarLottie());
  } catch {
    alTerminar?.(); // sin la librería, se sigue de largo
    return () => {};
  }

  const caja = document.createElement('div');
  const ancho = (cfg.tamano ?? 60) / 100 * ANCHO_ESC;
  caja.style.cssText = `position:absolute; left:${cfg.x ?? 50}%; top:${cfg.y ?? 50}%;`
    + `width:${ancho}px; height:${ancho}px; transform:translate(-50%,-50%);`
    + 'pointer-events:none; z-index:14;';

  const canvas = document.createElement('canvas');
  canvas.width = ancho; canvas.height = ancho;
  canvas.style.cssText = 'width:100%; height:100%; display:block';
  caja.appendChild(canvas);
  contenedor.appendChild(caja);

  let avisado = false;
  const avisarFin = () => { if (!avisado) { avisado = true; alTerminar?.(); } };

  const cortar = () => {
    clearTimeout(topeSeguridad);
    instancia.destroy();
    caja.remove();
    activasJuego.delete(cortar);
  };

  const instancia = new DotLottie({
    canvas, src: cfg.lottie_url, autoplay: true, loop: false,
    layout: { fit: 'contain' },
  });
  instancia.addEventListener('complete', () => { cortar(); avisarFin(); });
  instancia.addEventListener('loadError', () => { cortar(); avisarFin(); });

  // Respaldo: si el evento real nunca llega, esto no puede dejar a
  // quien esperaba (sobre todo la intro) colgado para siempre.
  const topeSeguridad = setTimeout(() => { cortar(); avisarFin(); }, 6000);

  activasJuego.add(cortar);
  return cortar;
}

export function detenerAnimacionesJuego() {
  activasJuego.forEach((cortar) => cortar());
  activasJuego.clear();
}
