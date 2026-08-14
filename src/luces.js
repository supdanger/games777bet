// =========================================================
// CADENAS DE LUCES — módulo compartido.
//
// Lo importan tanto el ensamblador (preview.js) como la pantalla real
// del jugador (jugar.js). Una sola copia a propósito: cuando esta
// lógica estaba duplicada en los dos archivos, se desincronizó y
// aparecieron bugs difíciles de ver. Si algo se corrige acá, queda
// corregido en los dos lados.
//
// La pantalla del juego mide SIEMPRE 420x860 por dentro (se escala
// entera al dispositivo), así que toda la geometría se calcula en
// esos píxeles fijos.
// =========================================================

export const ANCHO_ESC = 420;
export const ALTO_ESC = 860;

// ---------------- Forma de cada foco ----------------
// Círculo, cuadrado, rombo (cuadrado girado 45°) o barra
// (rectángulo con las puntas redondeadas). Ancho y alto van por
// separado, así se pueden hacer barras verticales u horizontales.
export function estiloForma(c) {
  const ancho = Number(c.ancho ?? c.tamano ?? 11);
  const alto = Number(c.alto ?? c.tamano ?? 11);
  const forma = c.forma || 'circulo';
  const radio = forma === 'circulo' ? '50%'
    : forma === 'barra' ? (Math.min(ancho, alto) / 2) + 'px'
    : '2px';
  const giro = forma === 'rombo' ? ' rotate(45deg)' : '';
  return { ancho, alto, radio, giro };
}

// ---------------- Geometría de la cadena ----------------
export function puntoEnPerimetro(i, total, rect) {
  const per = 2 * (rect.w + rect.h);
  const d = (per * i) / total;
  if (d < rect.w) return { x: rect.left + d, y: rect.top };
  if (d < rect.w + rect.h) return { x: rect.left + rect.w, y: rect.top + (d - rect.w) };
  if (d < 2 * rect.w + rect.h) return { x: rect.left + rect.w - (d - rect.w - rect.h), y: rect.top + rect.h };
  return { x: rect.left, y: rect.top + rect.h - (d - 2 * rect.w - rect.h) };
}

// Figura propia de la cadena: rectángulo, elipse o línea, con su
// tamaño y su rotación sobre el centro.
export function puntosFigura(c) {
  const cx = (c.figura_x ?? 50) / 100 * ANCHO_ESC;
  const cy = (c.figura_y ?? 50) / 100 * ALTO_ESC;
  const w = (c.figura_ancho ?? 60) / 100 * ANCHO_ESC;
  const h = (c.figura_alto ?? 30) / 100 * ALTO_ESC;
  const n = c.cantidad;
  const crudos = [];

  if ((c.figura || 'rectangulo') === 'circulo') {
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n - Math.PI / 2;
      crudos.push({ x: Math.cos(a) * w / 2, y: Math.sin(a) * h / 2 });
    }
  } else if (c.figura === 'linea') {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      crudos.push({ x: -w / 2 + t * w, y: 0 });
    }
  } else {
    const rect = { left: -w / 2, top: -h / 2, w, h };
    for (let i = 0; i < n; i++) crudos.push(puntoEnPerimetro(i, n, rect));
  }

  const rad = ((c.figura_rotacion ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad), sen = Math.sin(rad);
  return crudos.map((p) => ({
    x: cx + p.x * cos - p.y * sen,
    y: cy + p.x * sen + p.y * cos,
  }));
}

// En modo "libre" la fila de puntos sigue a la cantidad: al subirla
// se agregan cerca del último, al bajarla se recortan del final. Lo
// que ya se arrastró no se toca.
export function sincronizarPuntos(c) {
  if (!Array.isArray(c.puntos)) c.puntos = [];
  while (c.puntos.length < c.cantidad) {
    const ultimo = c.puntos[c.puntos.length - 1] || { x: 30, y: 50 };
    c.puntos.push({ x: Math.min(90, ultimo.x + 5), y: ultimo.y });
  }
  if (c.puntos.length > c.cantidad) c.puntos.length = c.cantidad;
}

export function posicionesCadena(c, rectMarco) {
  if (c.modo === 'marco') {
    const r = rectMarco();
    return Array.from({ length: c.cantidad }, (_, i) => puntoEnPerimetro(i, c.cantidad, r));
  }
  if (c.modo === 'figura') return puntosFigura(c);
  sincronizarPuntos(c);
  return c.puntos.map((p) => ({ x: p.x / 100 * ANCHO_ESC, y: p.y / 100 * ALTO_ESC }));
}

// ---------------- Dibujado de los focos ----------------
// Cada foco es una lamparita, no un círculo plano: el centro va casi
// blanco y se abre al color hacia el borde, con un resplandor que
// desborda. Apagado no desaparece — queda opaco y oscurecido, como
// una lámpara sin corriente.
export function construirCadena(wrap, c, rectMarco) {
  wrap.innerHTML = '';
  const f = estiloForma(c);
  const posiciones = posicionesCadena(c, rectMarco);

  c._dots = posiciones.map((p) => {
    const dot = document.createElement('div');
    dot.style.cssText = `position:absolute; left:${p.x / ANCHO_ESC * 100}%; top:${p.y / ALTO_ESC * 100}%;`
      + `width:${f.ancho}px; height:${f.alto}px; border-radius:${f.radio};`
      + `transform:translate(-50%,-50%)${f.giro};`
      + 'transition:opacity .12s; will-change:opacity;';

    // Reflejo del vidrio: un puntito claro arriba a la izquierda.
    if (c.vidrio ?? true) {
      const brillo = document.createElement('div');
      brillo.className = 'luz-vidrio';
      brillo.style.cssText = 'position:absolute; left:26%; top:16%; width:30%; height:22%;'
        + 'border-radius:50%; background:rgba(255,255,255,.55); filter:blur(1px); pointer-events:none;';
      dot.appendChild(brillo);
    }
    wrap.appendChild(dot);
    return dot;
  });
}

// Pinta UN foco. Separado a propósito: es lo único que corre en cada
// frame, así el resto (posiciones, elementos) no se recalcula.
// Pinta UN foco. Es lo único que corre en cada paso de la animación,
// así que está escrito para tocar lo menos posible:
//
//  - `background` y `box-shadow` obligan al navegador a REPINTAR el
//    foco y su halo. Son lo caro, y antes se reescribían siempre.
//    Ahora solo se tocan cuando el foco realmente cambia de color,
//    que en la mayoría de las animaciones no pasa nunca (cada foco
//    tiene su color fijo y solo se prende y se apaga).
//
//  - Prender y apagar pasa a resolverse SOLO con `opacity`, que la
//    placa de video maneja sin repintar nada. Se sacó el `filter`
//    por el mismo motivo: se veía casi igual y costaba un repintado
//    por foco por paso.
//
// Con luces en pantalla el giro de los rodillos se sentía despareja:
// el repintado del resplandor competía con la animación. Este es el
// motivo por el que se hizo así y no de la forma obvia.
function pintarFoco(dot, color, encendido, c) {
  if (dot._color !== color) {
    dot._color = color;
    const glow = Number(c.glow ?? 14);
    const nucleo = Number(c.nucleo ?? 45);
    dot.style.background = `radial-gradient(circle at 50% 45%, #fff 0%, #fff ${nucleo * 0.35}%, ${color} ${Math.max(nucleo, 40)}%, ${color} 100%)`;
    dot.style.boxShadow = glow > 0
      ? `0 0 ${glow}px ${glow * 0.4}px ${color}, 0 0 ${glow * 2.2}px ${color}55`
      : 'none';
  }

  const apagado = Math.max(0.12, Number(c.apagado ?? 18) / 100);
  const op = encendido ? 1 : apagado;
  if (dot._op !== op) {
    dot._op = op;
    dot.style.opacity = op;
  }
}

// ---------------- Animaciones ----------------
// Todas reciben el tiempo transcurrido y deciden, para cada foco, qué
// color le toca y si está encendido. El resto lo hace pintarFoco.
export function animarCadena(c, ahora) {
  const dots = c._dots || [];
  if (!dots.length) return;
  const n = dots.length;
  const vel = Number(c.velocidad) || 1;
  const colores = c.colores?.length ? c.colores : ['#EF9F27'];

  if (c.animacion === 'sincronizado') {
    const idx = Math.floor(ahora / (700 / vel)) % colores.length;
    const pulso = Math.abs(Math.sin(ahora / (400 / vel)));
    dots.forEach((dot) => pintarFoco(dot, colores[idx], pulso > 0.35, c));
    return;
  }

  if (c.animacion === 'alternado') {
    const paso = Math.floor(ahora / (450 / vel)) % 2;
    dots.forEach((dot, i) => pintarFoco(dot, colores[i % colores.length], i % 2 === paso, c));
    return;
  }

  if (c.animacion === 'aleatorio') {
    // El desfasaje sale del propio índice, así el patrón es estable
    // entre frames y no salta de golpe en cada repintado.
    dots.forEach((dot, i) => {
      const semilla = Math.sin(i * 12.9898) * 43758.5453;
      const desfase = (semilla - Math.floor(semilla)) * 1000;
      pintarFoco(dot, colores[i % colores.length], Math.sin((ahora + desfase) / (300 / vel)) > 0.2, c);
    });
    return;
  }

  if (c.animacion === 'vaiven') {
    const largo = n * 2 - 2 || 1;
    const ciclo = (ahora / (260 / vel)) % largo;
    const activo = ciclo < n ? Math.floor(ciclo) : Math.floor(largo - ciclo);
    dots.forEach((dot, i) => pintarFoco(dot, colores[i % colores.length], i === activo, c));
    return;
  }

  if (c.animacion === 'ola') {
    dots.forEach((dot, i) => {
      const idx = Math.floor(ahora / (300 / vel) + i) % colores.length;
      pintarFoco(dot, colores[idx], true, c);
    });
    return;
  }

  // secuencial (por defecto)
  const fase = (ahora / (260 / vel)) % n;
  dots.forEach((dot, i) => {
    const encendido = Math.abs(((i - fase) % n + n) % n) < 1;
    pintarFoco(dot, colores[i % colores.length], encendido, c);
  });
}

// ---------------- Bucle de animación ----------------
// Un solo bucle para TODAS las cadenas, con requestAnimationFrame en
// vez de setInterval: así el navegador lo sincroniza con el repintado
// de pantalla en lugar de interrumpir en cualquier momento. Eso
// importa sobre todo en celulares, donde el resplandor de los focos
// compitiendo con el giro de los rodillos se notaba como tironcitos.
//
// Se limita a ~11 cuadros por segundo a propósito: las luces no
// necesitan más y así le dejan el resto del tiempo a la animación de
// los rodillos, que sí necesita ir fluida.
export function iniciarAnimacionLuces(obtenerCadenas, estaOcupado) {
  const t0 = Date.now();
  let ultimo = 0;
  let vivo = true;

  const paso = () => {
    if (!vivo) return;
    const ahora = Date.now();
    // Se mantiene un respiro extra mientras los rodillos giran, por
    // las dudas: aunque ahora prender y apagar un foco es barato,
    // cuando cambia de color sí hay repintado, y en cadenas de muchos
    // focos con varios colores eso se acumula.
    const cada = estaOcupado?.() ? 130 : 90;
    if (ahora - ultimo >= cada) {
      ultimo = ahora;
      obtenerCadenas().forEach((c) => animarCadena(c, ahora - t0));
    }
    requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);

  return () => { vivo = false; };
}
