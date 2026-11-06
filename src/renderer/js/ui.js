/** Utilidades de interfaz: plantillas seguras, avisos, modales y sonido. */
import { escapar } from '../../shared/utilidades.js';

// ---------- Plantillas HTML con escape automático ----------
class Crudo { constructor(s) { this.s = s; } toString() { return this.s; } }
export const crudo = (s) => new Crudo(String(s));
const valor = (v) => {
  if (v instanceof Crudo) return v.s;
  if (Array.isArray(v)) return v.map(valor).join('');
  if (v === null || v === undefined || v === false) return '';
  return escapar(v);
};
/** html`<p>${texto}</p>` escapa todo lo interpolado salvo lo marcado con crudo(). */
export const html = (partes, ...vals) => crudo(partes.reduce((acc, p, i) => acc + p + (i < vals.length ? valor(vals[i]) : ''), ''));

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
export const icono = (id, clase = 'i') => crudo(`<svg class="${clase}" aria-hidden="true"><use href="#i-${id}"/></svg>`);
export function pintar(el, plantilla) { el.innerHTML = String(plantilla); }

// ---------- Avisos ----------
export function avisar(mensaje, tipo = 'ok', ms = 3200) {
  const caja = $('[data-toasts]');
  const t = document.createElement('div');
  t.className = `toast ${tipo}`;
  t.innerHTML = String(mensaje instanceof Crudo ? mensaje : escapar(mensaje));
  caja.append(t);
  // Máximo 3 avisos a la vez: se retira el más antiguo
  while (caja.children.length > 3) caja.firstElementChild.remove();
  setTimeout(() => t.remove(), ms);
}

// ---------- Modales (elemento <dialog> nativo: accesible y con foco atrapado) ----------
/**
 * Abre un modal. `contenido` es HTML; `alAceptar(form)` puede devolver false o
 * lanzar un error para mantenerlo abierto. Devuelve lo que retorne alAceptar, o null si se cancela.
 */
export function modal({ titulo, contenido, aceptar = 'Guardar', cancelar = 'Cancelar', peligro = false, alAceptar, alAbrir }) {
  return new Promise((resolver) => {
    const d = document.createElement('dialog');
    d.className = 'modal';
    d.innerHTML = String(html`
      <form method="dialog" novalidate>
        <div class="modal-cabeza"><h2>${titulo}</h2><button type="button" class="btn-icono" data-cerrar aria-label="Cerrar">${icono('x')}</button></div>
        <div class="modal-cuerpo">${contenido}<p class="error-form" data-error hidden></p></div>
        <div class="modal-pie">
          ${cancelar ? html`<button type="button" class="btn btn--borde" data-cerrar>${cancelar}</button>` : ''}
          <button type="submit" class="btn ${peligro ? 'btn--peligro' : 'btn--primario'}" data-aceptar>${aceptar}</button>
        </div>
      </form>`);
    document.body.append(d);
    const form = d.querySelector('form');
    const errorEl = d.querySelector('[data-error]');
    let resultado = null;
    const cerrar = () => d.close();
    d.addEventListener('close', () => { d.remove(); resolver(resultado); });
    d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-cerrar]')) cerrar(); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const boton = d.querySelector('[data-aceptar]');
      boton.disabled = true;
      errorEl.hidden = true;
      try {
        const r = alAceptar ? await alAceptar(form, d) : true;
        if (r === false) return;
        resultado = r ?? true;
        cerrar();
      } catch (err) {
        errorEl.textContent = err.mensajeUsuario ?? err.message;
        errorEl.hidden = false;
      } finally {
        boton.disabled = false;
      }
    });
    d.showModal();
    alAbrir?.(d);
  });
}

export const confirmar = (titulo, texto, { aceptar = 'Sí, continuar', peligro = false } = {}) =>
  modal({ titulo, contenido: html`<p>${texto}</p>`, aceptar, peligro });

// ---------- Sonido de nuevo pedido (sintetizado: no necesita archivos) ----------
let audio;
export function sonarNuevoPedido() {
  if (localStorage.getItem('qb-sonido') === 'off') return;
  try {
    audio ??= new AudioContext();
    const t0 = audio.currentTime;
    [[880, 0], [1175, 0.16], [1568, 0.32]].forEach(([f, dt]) => {
      const osc = audio.createOscillator();
      const vol = audio.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      vol.gain.setValueAtTime(0.0001, t0 + dt);
      vol.gain.exponentialRampToValueAtTime(0.25, t0 + dt + 0.02);
      vol.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.35);
      osc.connect(vol).connect(audio.destination);
      osc.start(t0 + dt);
      osc.stop(t0 + dt + 0.4);
    });
  } catch { /* sin audio disponible */ }
}

/** Ejecuta fn como máximo una vez cada `ms` (agrupa ráfagas de eventos). */
export function agrupar(fn, ms = 300) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
