/**
 * Gráficas SVG ligeras (sin librerías).
 * Reglas: una sola serie con un solo color (sin leyenda), barras ≤ 24 px con
 * punta redondeada de 4 px y base recta, líneas guía finas, etiqueta solo en
 * el valor máximo, tooltip al pasar el mouse y tabla de datos alternativa.
 */
import { html, crudo } from './ui.js';
import { formatearCOP } from '../../shared/dinero.js';
import { escapar } from '../../shared/utilidades.js';

/** $1.250.000 → "$1,3 M" · $450.000 → "$450 mil" */
export function formatoCompacto(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000).toLocaleString('es-CO')} mil`;
  return `$${n}`;
}

/** Escala "bonita" para el eje: 0, paso, 2·paso… cubriendo el máximo */
function escala(max, marcas = 4) {
  if (max <= 0) return { tope: 1, paso: 1 };
  const bruto = max / marcas;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= bruto);
  return { tope: paso * Math.ceil(max / paso), paso };
}

/** Barra vertical con punta redondeada (4 px) y base recta */
function rutaBarra(x, y, w, h, r = 4) {
  if (h <= 0) return '';
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

/**
 * Columnas verticales.
 * datos: [{ etiqueta, valor, detalle }]  ·  etiqueta: texto corto del eje X
 */
export function columnas(datos, { alto = 230, ancho = 760, nombre = 'Ventas' } = {}) {
  const m = { izq: 60, der: 8, arr: 22, aba: 26 };
  const W = ancho - m.izq - m.der;
  const H = alto - m.arr - m.aba;
  const max = Math.max(0, ...datos.map((d) => d.valor));
  const { tope, paso } = escala(max);
  const banda = W / Math.max(1, datos.length);
  const grosor = Math.min(24, Math.max(3, banda - 2)); // 2 px de aire entre barras como mínimo
  const y = (v) => m.arr + H - (v / tope) * H;
  const cadaN = Math.ceil(datos.length / Math.floor(W / 46)); // evita que las etiquetas se monten
  const iMax = datos.findIndex((d) => d.valor === max && max > 0);

  const lineas = [];
  for (let v = 0; v <= tope + 1e-9; v += paso) {
    lineas.push(`<line class="${v === 0 ? 'base' : 'rejilla-linea'}" x1="${m.izq}" x2="${ancho - m.der}" y1="${y(v)}" y2="${y(v)}"/>`,
      `<text class="eje" x="${m.izq - 8}" y="${y(v) + 4}" text-anchor="end">${escapar(formatoCompacto(v))}</text>`);
  }
  const barras = datos.map((d, i) => {
    const cx = m.izq + banda * i + banda / 2;
    const h = (d.valor / tope) * H;
    return `<g data-i="${i}">
      <rect class="zona-hover" x="${m.izq + banda * i}" y="${m.arr}" width="${banda}" height="${H}" data-tip="${i}"/>
      <path class="barra-dato" d="${rutaBarra(cx - grosor / 2, m.arr + H - h, grosor, h)}"/>
      ${i % cadaN === 0 || i === datos.length - 1 ? `<text class="eje" x="${cx}" y="${alto - 8}" text-anchor="middle">${escapar(d.etiqueta)}</text>` : ''}
      ${i === iMax ? `<text class="etiqueta-max" x="${cx}" y="${y(d.valor) - 7}" text-anchor="middle">${escapar(formatoCompacto(d.valor))}</text>` : ''}
    </g>`;
  }).join('');

  const tips = JSON.stringify(datos.map((d, i) => ({
    x: ((m.izq + banda * i + banda / 2) / ancho) * 100,
    y: (y(d.valor) / alto) * 100,
    t: `${d.detalle ?? d.etiqueta}`,
    v: formatearCOP(d.valor),
    n: d.pedidos,
  })));

  return html`
    <div class="grafica" data-grafica data-tips="${tips}">
      ${crudo(`<svg viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="${escapar(nombre)}">${lineas.join('')}${barras}</svg>`)}
      <div class="tooltip" hidden></div>
    </div>`;
}

/** Barras horizontales con etiqueta y valor (para métodos de pago, canales, productos). */
export function barrasHorizontales(filas, { valor = (f) => f.total, etiqueta, detalle } = {}) {
  const max = Math.max(1, ...filas.map(valor));
  return html`
    <div class="barras-h">
      ${filas.map((f) => html`
        <div class="barra-h">
          <span>${etiqueta(f)}</span>
          <div class="pista"><div class="relleno" style="width:${(valor(f) / max) * 100}%"></div></div>
          <span class="valor num">${formatearCOP(valor(f))}${detalle ? html`<small>${detalle(f)}</small>` : ''}</span>
        </div>`)}
    </div>`;
}

/** Activa los tooltips de todas las gráficas dentro de `raiz`. */
export function activarTooltips(raiz) {
  raiz.addEventListener('mouseover', (e) => {
    const zona = e.target.closest('[data-tip]');
    const g = e.target.closest('[data-grafica]');
    if (!zona || !g) return;
    const d = JSON.parse(g.dataset.tips)[Number(zona.dataset.tip)];
    const tip = g.querySelector('.tooltip');
    tip.innerHTML = `${escapar(d.t)}<br><b>${escapar(d.v)}</b>${d.n !== undefined ? ` · ${d.n} ${d.n === 1 ? 'pedido' : 'pedidos'}` : ''}`;
    tip.style.left = `${d.x}%`;
    tip.style.top = `${d.y}%`;
    tip.hidden = false;
    g.querySelectorAll('.barra-dato.activa').forEach((b) => b.classList.remove('activa'));
    zona.nextElementSibling?.classList.add('activa');
  });
  raiz.addEventListener('mouseout', (e) => {
    const g = e.target.closest('[data-grafica]');
    if (g && !g.contains(e.relatedTarget)) {
      g.querySelector('.tooltip').hidden = true;
      g.querySelectorAll('.barra-dato.activa').forEach((b) => b.classList.remove('activa'));
    }
  });
}
