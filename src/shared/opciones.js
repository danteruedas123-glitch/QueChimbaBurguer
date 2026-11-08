/**
 * Opciones al pedir (bebida del combo, en agua o en leche, nivel, con papas…).
 * Misma lógica que la base de datos (migración 10) y que la web: el precio
 * final lo calcula SIEMPRE el servidor; esto es para mostrarlo antes.
 *
 * Grupo: { titulo, elige, opciones: [{ nombre, extra }] }  o  { titulo, elige, lista }
 *   lista: 'gaseosas' | 'bebidas_michelada'  (listas que el dueño edita en Ajustes)
 */
import { parsearCOP, formatearCOP } from './dinero.js';

export const LISTAS = { gaseosas: 'gaseosas', bebidas_michelada: 'micheladas' };

/** Opciones concretas de un grupo (las listas salen de los ajustes). */
export function opcionesDe(grupo, bebidas = {}) {
  return grupo.lista ? (bebidas[grupo.lista] ?? []).map((nombre) => ({ nombre, extra: 0 })) : grupo.opciones;
}

export const tieneOpciones = (p) => (p?.opciones?.length ?? 0) > 0;

/** ¿Lo elegido es válido para el producto? elegidas = [["En leche"], ["Coca-Cola", "Pepsi"]] */
export function eleccionValida(p, elegidas, bebidas = {}) {
  if (!tieneOpciones(p)) return elegidas == null || (Array.isArray(elegidas) && elegidas.length === 0);
  return Array.isArray(elegidas) && elegidas.length === p.opciones.length && p.opciones.every((g, i) =>
    Array.isArray(elegidas[i]) && elegidas[i].length === g.elige
    && elegidas[i].every((n) => opcionesDe(g, bebidas).some((o) => o.nombre === n)));
}

/** Extra por unidad según lo elegido. */
export function extraDe(p, elegidas, bebidas = {}) {
  return (elegidas ?? []).reduce((s, sel, i) =>
    s + sel.reduce((t, n) => t + (opcionesDe(p.opciones[i], bebidas).find((o) => o.nombre === n)?.extra ?? 0), 0), 0);
}

/** Texto para la cocina y el ticket: "Preparación: En leche · Gaseosas: Coca-Cola, Pepsi" (igual que el servidor). */
export function detalleDe(p, elegidas) {
  return (elegidas ?? []).map((sel, i) => `${p.opciones[i].titulo}: ${sel.join(', ')}`).join(' · ');
}

/** Clave de una línea: el producto y lo elegido (lo distinto va en líneas separadas). */
export const claveLinea = (id, elegidas) => (elegidas ? `${id}~${JSON.stringify(elegidas)}` : id);
export function leerLinea(clave) {
  const i = clave.indexOf('~');
  if (i < 0) return { id: clave, elegidas: null };
  try { return { id: clave.slice(0, i), elegidas: JSON.parse(clave.slice(i + 1)) }; } catch { return { id: clave.slice(0, i), elegidas: [] }; }
}

// ---------- Editor en texto (pantalla Menú de la app) ----------
// Una línea por grupo:
//   Preparación: En agua, En leche +2000
//   Gaseosas x2: [gaseosas]
//   Bebida: [micheladas]

/** Grupos → texto para editar. */
export function aTexto(grupos = []) {
  return grupos.map((g) => {
    const cabeza = `${g.titulo}${g.elige > 1 ? ` x${g.elige}` : ''}`;
    const cuerpo = g.lista
      ? `[${LISTAS[g.lista]}]`
      : g.opciones.map((o) => `${o.nombre}${o.extra ? ` +${formatearCOP(o.extra).replace('$', '')}` : ''}`).join(', ');
    return `${cabeza}: ${cuerpo}`;
  }).join('\n');
}

/** Texto → grupos. Lanza un Error con un mensaje claro si algo está mal. */
export function desdeTexto(texto) {
  const lineas = String(texto ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (lineas.length > 6) throw new Error('Máximo 6 grupos de opciones');
  return lineas.map((linea, n) => {
    const m = linea.match(/^(.+?)(?:\s+x\s*(\d+))?\s*:\s*(.+)$/i);
    if (!m) throw new Error(`Línea ${n + 1}: usa el formato "Título: opción, opción +2000"`);
    const titulo = m[1].trim();
    const elige = m[2] ? Number(m[2]) : 1;
    if (titulo.length > 30) throw new Error(`Línea ${n + 1}: el título es muy largo (máx. 30 letras)`);
    if (elige < 1 || elige > 5) throw new Error(`Línea ${n + 1}: se pueden elegir de 1 a 5`);
    const lista = m[3].trim().match(/^\[(gaseosas?|micheladas?|bebidas para michelada)\]$/i);
    if (lista) return { titulo, elige, lista: /gaseosa/i.test(lista[1]) ? 'gaseosas' : 'bebidas_michelada' };
    const opciones = m[3].split(',').map((x) => x.trim()).filter(Boolean).map((x) => {
      const o = x.match(/^(.+?)(?:\s*\+\s*\$?\s*([\d.]+))?$/);
      const extra = o[2] ? parsearCOP(o[2]) : 0;
      if (extra === null) throw new Error(`Línea ${n + 1}: el valor de "${o[1]}" debe ir en pesos (ej. +2000)`);
      if (o[1].trim().length > 40) throw new Error(`Línea ${n + 1}: "${o[1].trim()}" es muy largo (máx. 40 letras)`);
      return { nombre: o[1].trim(), extra };
    });
    if (opciones.length < 2) throw new Error(`Línea ${n + 1}: pon al menos 2 opciones separadas por coma`);
    if (new Set(opciones.map((o) => o.nombre)).size !== opciones.length) throw new Error(`Línea ${n + 1}: hay opciones repetidas`);
    return { titulo, elige, opciones };
  });
}
