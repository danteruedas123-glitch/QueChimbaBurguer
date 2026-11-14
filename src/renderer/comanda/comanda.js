/**
 * Arma la comanda de un pedido para imprimir. Todo el texto entra con
 * textContent (nunca como HTML): un nombre o una nota con código malicioso
 * se imprime como texto y no se ejecuta.
 */
import { formatearCOP } from '../../shared/dinero.js';
import { ETIQUETA_CANAL, ETIQUETA_ENTREGA, ETIQUETA_PAGO } from '../../shared/estados.js';

const el = (etiqueta, clase, texto) => {
  const e = document.createElement(etiqueta);
  if (clase) e.className = clase;
  if (texto !== undefined && texto !== null) e.textContent = String(texto);
  return e;
};
const dato = (titulo, valor) => {
  const p = el('p', 'dato');
  p.append(el('b', '', `${titulo}: `), document.createTextNode(String(valor)));
  return p;
};
const filaTotal = (titulo, valor, clase = '') => {
  const tr = el('tr', clase);
  tr.append(el('td', '', titulo), el('td', '', valor));
  return tr;
};

window.pintarComanda = ({ pedido: p, ancho = 80, negocio = 'Quechimba Burger' }) => {
  document.documentElement.classList.toggle('ancho-58', Number(ancho) === 58);
  const fecha = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' }).format(new Date(p.creado_en));
  const raiz = document.getElementById('comanda');
  raiz.replaceChildren();

  const cabeza = el('header', 'centro');
  cabeza.append(
    el('div', 'negocio', negocio),
    el('div', 'numero', `#${String(p.numero).padStart(4, '0')}`),
    el('div', 'etiqueta', `${ETIQUETA_CANAL[p.canal] ?? p.canal} · ${ETIQUETA_ENTREGA[p.tipo_entrega] ?? p.tipo_entrega}`),
    el('div', '', fecha),
  );
  raiz.append(cabeza, el('hr', 'linea'));

  if (p.cliente_nombre) raiz.append(dato('Cliente', p.cliente_nombre));
  if (p.cliente_telefono) raiz.append(dato('Tel', p.cliente_telefono));
  if (p.direccion) raiz.append(dato('Dirección', p.direccion));
  if (p.cliente_nombre || p.cliente_telefono || p.direccion) raiz.append(el('hr', 'linea'));

  const tabla = el('table', 'items');
  for (const i of p.items ?? []) {
    const tr = el('tr');
    const nombre = el('td', 'nombre', i.nombre);
    if (i.detalle) nombre.append(el('span', 'detalle', i.detalle));
    tr.append(el('td', 'cant', `${i.cantidad}×`), nombre, el('td', 'valor', formatearCOP(i.subtotal)));
    tabla.append(tr);
  }
  raiz.append(tabla);

  if (p.notas) raiz.append(el('div', 'notas', `NOTA: ${p.notas}`));
  raiz.append(el('hr', 'linea'));

  const totales = el('table', 'totales');
  totales.append(filaTotal('Subtotal', formatearCOP(p.subtotal)));
  if (p.costo_domicilio) totales.append(filaTotal('Domicilio', formatearCOP(p.costo_domicilio)));
  else if (p.tipo_entrega === 'domicilio') totales.append(filaTotal('Domicilio', 'por cobrar'));
  if (p.descuento) totales.append(filaTotal('Descuento', `-${formatearCOP(p.descuento)}`));
  totales.append(filaTotal('TOTAL', formatearCOP(p.total), 'grande'));
  raiz.append(totales, dato('Pago', ETIQUETA_PAGO[p.metodo_pago] ?? p.metodo_pago));

  raiz.append(el('p', 'pie centro', '¡Gracias por tu pedido!'));
  // Alto real de la hoja (para que la impresora corte justo al final)
  return Math.ceil(raiz.getBoundingClientRect().height);
};
