/**
 * Arranque de la app: conexión → inicio de sesión → verificación de
 * versión mínima → panel principal con sus vistas.
 */
import { crearFuente, crearApi } from './datos.js';
import { html, icono, pintar, $, $$, avisar } from './ui.js';
import { mensajeError, compararVersiones } from '../../shared/utilidades.js';
import * as vistaPedidos from './vistas/pedidos.js';
import * as vistaVenta from './vistas/venta.js';
import * as vistaMenu from './vistas/menu.js';
import * as vistaContabilidad from './vistas/contabilidad.js';
import * as vistaAjustes from './vistas/ajustes.js';

const VISTAS = {
  pedidos: { titulo: 'Pedidos', icono: 'pedidos', modulo: vistaPedidos },
  venta: { titulo: 'Nueva venta', icono: 'caja', modulo: vistaVenta },
  menu: { titulo: 'Menú', icono: 'menu', modulo: vistaMenu },
  contabilidad: { titulo: 'Contabilidad', icono: 'grafica', modulo: vistaContabilidad },
  ajustes: { titulo: 'Ajustes', icono: 'ajustes', modulo: vistaAjustes },
};

const raiz = $('#app');
let config;
let api;
let vistaActual = null;
let desmontar = null;

async function iniciar() {
  config = await window.qb.config.leer();
  const fuente = crearFuente(config);
  raiz.classList.remove('app-cargando');
  raiz.removeAttribute('aria-busy');
  if (!fuente) return pantallaConexion();
  api = crearApi(fuente);

  // Versión mínima exigida por el negocio (para cambios críticos)
  try {
    const info = await api.appInfo();
    if (compararVersiones(config.version, info.version_minima_escritorio) < 0) {
      return pantallaBloqueo(info.version_minima_escritorio);
    }
  } catch (e) {
    if (!config.modoDemo) return pantallaConexion(`No se pudo conectar con la base de datos: ${mensajeError(e)}`);
  }

  const usuario = await fuente.usuarioActual();
  if (!usuario) return pantallaLogin();
  await entrar();
}

// ---------- Pantallas de acceso ----------
function pantallaConexion(error = '') {
  pintar(raiz, html`
    <main class="pantalla-acceso">
      <div class="caja-acceso ancha">
        <img class="logo" src="img/logo.webp" alt="" width="92" height="92">
        <h1>Conectar con Supabase</h1>
        <p class="sub">Solo se hace una vez en este computador.</p>
        <ol class="pasos-conexion">
          <li>Entra a <b>supabase.com</b> → tu proyecto → <b>Project Settings</b> → <b>API</b>.</li>
          <li>Copia la <b>Project URL</b> y la llave pública <b>anon / publishable</b>.</li>
          <li>Nunca uses la llave <b>service_role</b> (secreta) aquí.</li>
        </ol>
        <form data-form>
          <label class="campo"><span>Project URL</span><input name="url" placeholder="https://xxxx.supabase.co" required autocomplete="off"></label>
          <label class="campo"><span>Llave pública (anon)</span><input name="llave" required autocomplete="off" spellcheck="false"></label>
          <p class="error-form" data-error ${error ? '' : 'hidden'}>${error}</p>
          <button class="btn btn--primario btn--lg" type="submit">Guardar y conectar</button>
        </form>
      </div>
    </main>`);
  $('[data-form]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const r = await window.qb.config.guardar({ supabaseUrl: f.url.value.trim(), supabaseAnonKey: f.llave.value.trim() });
    if (r.error) {
      const el = $('[data-error]');
      el.textContent = r.error;
      el.hidden = false;
      return;
    }
    window.qb.recargar();
  });
}

function pantallaBloqueo(minima) {
  pintar(raiz, html`
    <main class="pantalla-acceso">
      <div class="caja-acceso">
        <img class="logo" src="img/logo.webp" alt="" width="92" height="92">
        <h1>Actualización necesaria</h1>
        <p class="sub">Esta versión (${config.version}) ya no es compatible. Se necesita la ${minima} o superior.</p>
        <p class="nota-demo">La actualización se descarga sola. Si ya terminó, cierra y vuelve a abrir la app.</p>
        <button class="btn btn--primario btn--lg" data-buscar>Buscar actualización</button>
      </div>
    </main>`);
  $('[data-buscar]').addEventListener('click', () => window.qb.actualizador.buscar());
}

function pantallaLogin() {
  pintar(raiz, html`
    <main class="pantalla-acceso">
      <div class="caja-acceso">
        <img class="logo" src="img/logo.webp" alt="" width="92" height="92">
        <h1>Quechimba Pedidos</h1>
        <p class="sub">Inicia sesión para recibir pedidos.</p>
        ${config.modoDemo ? html`<p class="nota-demo"><b>Modo demo.</b> Usuario: demo@quechimba.co · Contraseña: demo1234</p>` : ''}
        <form data-form>
          <label class="campo"><span>Correo</span><input name="email" type="email" autocomplete="username" required value="${config.modoDemo ? 'demo@quechimba.co' : ''}"></label>
          <label class="campo"><span>Contraseña</span><input name="password" type="password" autocomplete="current-password" required></label>
          <p class="error-form" data-error hidden></p>
          <button class="btn btn--primario btn--lg" type="submit" data-entrar>Entrar</button>
        </form>
      </div>
    </main>`);
  const form = $('[data-form]');
  (config.modoDemo ? form.password : form.email).focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const boton = $('[data-entrar]');
    const err = $('[data-error]');
    boton.disabled = true;
    err.hidden = true;
    try {
      await api.fuente.iniciarSesion(form.email.value.trim(), form.password.value);
      await entrar();
    } catch (ex) {
      err.textContent = mensajeError(ex);
      err.hidden = false;
      boton.disabled = false;
    }
  });
}

async function entrar() {
  let perfil;
  try {
    perfil = await api.perfil();
  } catch (e) {
    await api.fuente.cerrarSesion();
    pantallaLogin();
    avisar(mensajeError(e), 'error');
    return;
  }
  if (!perfil?.es_staff) {
    await api.fuente.cerrarSesion();
    pantallaLogin();
    const err = $('[data-error]');
    err.textContent = 'Este usuario no está autorizado como personal del negocio.';
    err.hidden = false;
    return;
  }
  montarShell(perfil);
}

// ---------- Panel principal ----------
function montarShell(perfil) {
  pintar(raiz, html`
    <div class="shell">
      <aside class="lateral">
        <div class="marca"><img src="img/logo.webp" alt="" width="46" height="46"><div><b>Quechimba</b><small>Pedidos</small></div></div>
        <nav class="nav" aria-label="Secciones">
          ${Object.entries(VISTAS).map(([id, v]) => html`
            <a href="#${id}" data-vista="${id}">${icono(v.icono)}<span>${v.titulo}</span>${id === 'pedidos' ? html`<span class="contador" data-contador hidden>0</span>` : ''}</a>`)}
        </nav>
        <div class="lateral-pie">
          <div class="aviso-actualizacion" data-aviso-update hidden></div>
          <div class="usuario">
            <div><b>${perfil.nombre}</b>${config.modoDemo ? 'Modo demo' : perfil.rol === 'admin' ? 'Administrador' : 'Encargado'}</div>
            <button class="btn-icono" data-salir title="Cerrar sesión" aria-label="Cerrar sesión">${icono('salir')}</button>
          </div>
          <span>Versión ${config.version}</span>
        </div>
      </aside>
      <section class="principal">
        <header class="barra">
          <h1 data-titulo></h1>
          <div class="barra-acciones">
            ${config.modoDemo ? html`<button class="btn btn--borde btn--sm" data-simular>${icono('campana')} Simular pedido web</button>` : ''}
            <a class="chip-web" href="#ajustes" data-chip-web hidden></a>
            <span class="estado-conexion" data-conexion>Conectando…</span>
          </div>
        </header>
        <div class="contenido" data-contenido tabindex="-1"></div>
      </section>
    </div>`);

  $('[data-salir]').addEventListener('click', async () => {
    desmontar?.();
    await api.fuente.cerrarSesion();
    location.hash = '';
    pantallaLogin();
  });
  $('[data-simular]')?.addEventListener('click', async () => {
    try {
      const r = await api.fuente.simularPedidoWeb();
      if (vistaActual !== 'pedidos') avisar(html`Llegó el pedido web <b>#${r.numero}</b>`);
    } catch (e) { avisar(mensajeError(e), 'error'); }
  });

  window.addEventListener('hashchange', () => navegar(location.hash.slice(1)));
  configurarActualizaciones();
  api.menu().then((m) => ctx.estadoWeb(m.ajustes.pedidos_web_activos)).catch(() => {});
  navegar(location.hash.slice(1) || 'pedidos');
}

const ctx = {
  get api() { return api; },
  get config() { return config; },
  /** Cambia el contador rojo de pedidos pendientes en el menú lateral. */
  contadorPedidos(n) {
    const el = $('[data-contador]');
    if (!el) return;
    el.textContent = n;
    el.hidden = n === 0;
  },
  estadoConexion(estado) {
    const el = $('[data-conexion]');
    if (!el) return;
    el.className = `estado-conexion ${estado}`;
    el.textContent = { 'en-vivo': config.modoDemo ? 'Demo en vivo' : 'En vivo', caida: 'Sin conexión', conectando: 'Conectando…' }[estado] ?? estado;
  },
  navegar: (id) => { location.hash = id; },
  /** Indicador en la barra superior: recuerda si la web está recibiendo pedidos. */
  estadoWeb(activa) {
    const el = $('[data-chip-web]');
    if (!el) return;
    el.hidden = false;
    el.className = `chip-web ${activa ? 'activa' : 'inactiva'}`;
    el.textContent = activa ? 'Web activada' : 'Web desactivada';
    el.title = activa ? 'La web está recibiendo pedidos' : 'La web NO está recibiendo pedidos. Toca para activarla en Ajustes.';
  },
};

let turnoNavegacion = 0;
async function navegar(id) {
  if (!VISTAS[id]) id = 'pedidos';
  if (vistaActual === id) return;
  desmontar?.();
  desmontar = null;
  vistaActual = id;
  // Si el encargado cambia de sección antes de que esta termine de cargar, su
  // limpieza no se puede perder (si no, sus eventos quedarían vivos para siempre)
  const turno = ++turnoNavegacion;
  $$('[data-vista]').forEach((a) => { if (a.dataset.vista === id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  $('[data-titulo]').textContent = VISTAS[id].titulo;
  // Contenedor NUEVO en cada sección: así los eventos de la sección anterior
  // desaparecen con ella y nunca se acumulan (evita clics duplicados).
  const viejo = $('[data-contenido]');
  const contenedor = viejo.cloneNode(false);
  viejo.replaceWith(contenedor);
  try {
    const limpiar = await VISTAS[id].modulo.montar(contenedor, ctx) ?? null;
    if (turno !== turnoNavegacion) { limpiar?.(); return; } // ya se fue a otra sección
    desmontar = limpiar;
  } catch (e) {
    if (turno !== turnoNavegacion) return;
    console.error(e);
    pintar(contenedor, html`<div class="vacio"><p>${mensajeError(e)}</p></div>`);
  }
  // La vista de pedidos siempre escucha en segundo plano para el contador y las alertas
  if (id !== 'pedidos') vistaPedidos.escucharEnFondo(ctx);
}

function configurarActualizaciones() {
  const aviso = $('[data-aviso-update]');
  const pintarAviso = (e) => {
    if (e.estado === 'lista') {
      aviso.hidden = false;
      pintar(aviso, html`<span><b>Versión ${e.nueva} lista.</b> Se instalará al cerrar la app.</span>
        <button class="btn btn--primario btn--sm" data-instalar>Reiniciar y actualizar</button>`);
      $('[data-instalar]', aviso).addEventListener('click', () => window.qb.actualizador.instalar());
    } else if (e.estado === 'disponible') {
      // Linux (Chromebook): la app no se reinstala sola; se descarga el instalador
      aviso.hidden = false;
      pintar(aviso, html`<span><b>Versión ${e.nueva} disponible.</b> Descárgala y ábrela para instalarla.</span>
        <button class="btn btn--primario btn--sm" data-instalar>Descargar</button>`);
      $('[data-instalar]', aviso).addEventListener('click', () => window.qb.actualizador.instalar());
    } else if (e.estado === 'descargando') {
      aviso.hidden = false;
      pintar(aviso, html`<span>Descargando versión ${e.nueva ?? ''}… ${e.progreso ?? 0}%</span>`);
    } else {
      aviso.hidden = true;
    }
  };
  window.qb.actualizador.estado().then(pintarAviso);
  window.qb.actualizador.alCambiar(pintarAviso);
}

window.addEventListener('unhandledrejection', (e) => {
  console.error(e.reason);
  avisar(mensajeError(e.reason), 'error');
});

iniciar().catch((e) => {
  console.error(e);
  pintar(raiz, html`<main class="pantalla-acceso"><div class="caja-acceso"><h1>Error al iniciar</h1><p class="sub">${mensajeError(e)}</p></div></main>`);
});
