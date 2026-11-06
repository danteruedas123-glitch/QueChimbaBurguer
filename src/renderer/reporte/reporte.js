/**
 * Plantilla del reporte PDF de contabilidad.
 * Cada tabla incluye su fila de TOTAL para que se pueda verificar a mano
 * que todo cuadra con el total de ventas.
 */
import { formatearCOP, variacion } from '../../shared/dinero.js';
import { etiquetaRango, fechaCorta, diaSemana } from '../../shared/periodos.js';
import { ETIQUETA_PAGO, ETIQUETA_CANAL, ETIQUETA_ENTREGA } from '../../shared/estados.js';
import { escapar as e } from '../../shared/utilidades.js';

const pct = (parte, total) => (total ? `${((parte / total) * 100).toLocaleString('es-CO', { maximumFractionDigits: 1 })} %` : '0 %');
const cop = (n) => e(formatearCOP(n));

function comparacion(actual, previo) {
  const v = variacion(actual, previo);
  if (v === null) return '<small>Sin datos del período anterior</small>';
  return `<small class="${v > 0 ? 'sube' : v < 0 ? 'baja' : ''}">${v > 0 ? '▲ +' : v < 0 ? '▼ ' : ''}${v.toLocaleString('es-CO')} % vs. período anterior</small>`;
}

function tabla(titulo, cabeceras, filas, total) {
  if (!filas.length) return `<section><h2>${e(titulo)}</h2><p class="vacio">Sin ventas en este período.</p></section>`;
  return `<section><h2>${e(titulo)}</h2><table>
    <thead><tr>${cabeceras.map(([t, der]) => `<th${der ? ' class="der"' : ''}>${e(t)}</th>`).join('')}</tr></thead>
    <tbody>${filas.map((f) => `<tr>${f.map(([v, der]) => `<td${der ? ' class="der"' : ''}>${v}</td>`).join('')}</tr>`).join('')}</tbody>
    ${total ? `<tfoot><tr>${total.map(([v, der]) => `<td${der ? ' class="der"' : ''}>${v}</td>`).join('')}</tr></tfoot>` : ''}
  </table></section>`;
}

window.pintarReporte = async ({ reporte: r, anterior, generado }) => {
  const s = r.resumen;
  const a = anterior?.resumen ?? {};
  const generadoTexto = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'long', timeStyle: 'short' }).format(new Date(generado));
  const varios = r.desde !== r.hasta;
  const sumaUnidades = r.por_producto.reduce((t, p) => t + p.unidades, 0);
  const maxDia = Math.max(1, ...r.por_dia.map((d) => d.total));

  document.getElementById('reporte').innerHTML = `
    <header class="cabecera">
      <img src="../img/logo.webp" alt="" width="64" height="64">
      <div>
        <h1>Reporte de ventas</h1>
        <p><b>Quechimba Burger</b> · Barrio La Florencia, Valledupar</p>
      </div>
      <div class="periodo">
        <span>Período</span>
        <b>${e(etiquetaRango(r))}</b>
        <small>Generado: ${e(generadoTexto)}</small>
      </div>
    </header>

    <section class="kpis">
      <div class="kpi principal"><span>Total ventas</span><b>${cop(s.total)}</b>${comparacion(s.total, a.total)}</div>
      <div class="kpi"><span>Pedidos</span><b>${s.pedidos}</b>${comparacion(s.pedidos, a.pedidos)}</div>
      <div class="kpi"><span>Ticket promedio</span><b>${cop(s.ticket_promedio)}</b>${comparacion(s.ticket_promedio, a.ticket_promedio)}</div>
      <div class="kpi"><span>Productos vendidos</span><b>${s.unidades}</b>${comparacion(s.unidades, a.unidades)}</div>
    </section>

    <section class="dos">
      <div>
        <h2>Cuadre del período</h2>
        <table class="cuadre">
          <tr><td>Ventas de productos</td><td class="der">${cop(s.subtotal)}</td></tr>
          <tr><td>+ Domicilios cobrados</td><td class="der">${cop(s.domicilios)}</td></tr>
          <tr><td>− Descuentos</td><td class="der">${cop(s.descuentos)}</td></tr>
          <tr class="total"><td>= Total ventas</td><td class="der">${cop(s.total)}</td></tr>
        </table>
      </div>
      <div>
        <h2>No incluidos en ventas</h2>
        <table class="cuadre">
          <tr><td>Pedidos cancelados / anulados</td><td class="der">${r.cancelados.pedidos} · ${cop(r.cancelados.total)}</td></tr>
          <tr><td>Pedidos sin cerrar</td><td class="der">${r.pendientes.pedidos} · ${cop(r.pendientes.total)}</td></tr>
        </table>
      </div>
    </section>

    ${tabla('Ventas por método de pago', [['Método'], ['Pedidos', 1], ['Valor', 1], ['% del total', 1]],
      r.por_metodo_pago.map((f) => [[e(ETIQUETA_PAGO[f.metodo])], [f.pedidos, 1], [cop(f.total), 1], [pct(f.total, s.total), 1]]),
      [['<b>Total</b>'], [`<b>${s.pedidos}</b>`, 1], [`<b>${cop(s.total)}</b>`, 1], ['100 %', 1]])}

    <section class="dos">
      ${tabla('Por canal', [['Canal'], ['Pedidos', 1], ['Valor', 1]],
        r.por_canal.map((f) => [[e(ETIQUETA_CANAL[f.canal])], [f.pedidos, 1], [cop(f.total), 1]]),
        [['<b>Total</b>'], [`<b>${s.pedidos}</b>`, 1], [`<b>${cop(s.total)}</b>`, 1]])}
      ${tabla('Por tipo de entrega', [['Entrega'], ['Pedidos', 1], ['Valor', 1]],
        r.por_entrega.map((f) => [[e(ETIQUETA_ENTREGA[f.tipo])], [f.pedidos, 1], [cop(f.total), 1]]),
        [['<b>Total</b>'], [`<b>${s.pedidos}</b>`, 1], [`<b>${cop(s.total)}</b>`, 1]])}
    </section>

    ${varios ? tabla('Ventas por día', [['Fecha'], [''], ['Pedidos', 1], ['Valor', 1], ['%', 1]],
      r.por_dia.map((d) => [[`${e(diaSemana(d.fecha))} ${e(fechaCorta(d.fecha))}`],
        [`<span class="barra" style="width:${(d.total / maxDia) * 100}%"></span>`],
        [d.pedidos, 1], [cop(d.total), 1], [pct(d.total, s.total), 1]]),
      [['<b>Total</b>'], [''], [`<b>${s.pedidos}</b>`, 1], [`<b>${cop(s.total)}</b>`, 1], ['100 %', 1]]) : ''}

    ${tabla('Ventas por producto', [['Producto'], ['Categoría'], ['Unidades', 1], ['Valor', 1], ['%', 1]],
      r.por_producto.map((p) => [[e(p.nombre)], [e(p.categoria)], [p.unidades, 1], [cop(p.total), 1], [pct(p.total, s.subtotal), 1]]),
      [['<b>Total productos</b>'], [''], [`<b>${sumaUnidades}</b>`, 1], [`<b>${cop(s.subtotal)}</b>`, 1], ['100 %', 1]])}

    <section class="dos">
      ${tabla('Por categoría', [['Categoría'], ['Unidades', 1], ['Valor', 1]],
        r.por_categoria.map((c) => [[e(c.categoria)], [c.unidades, 1], [cop(c.total), 1]]),
        [['<b>Total</b>'], [`<b>${sumaUnidades}</b>`, 1], [`<b>${cop(s.subtotal)}</b>`, 1]])}
      ${tabla('Ventas por hora', [['Hora'], ['Pedidos', 1], ['Valor', 1]],
        r.por_hora.filter((h) => h.pedidos).map((h) => [[`${h.hora}:00 – ${h.hora}:59`], [h.pedidos, 1], [cop(h.total), 1]]),
        [['<b>Total</b>'], [`<b>${s.pedidos}</b>`, 1], [`<b>${cop(s.total)}</b>`, 1]])}
    </section>

    <footer class="notas">
      <b>Criterios:</b> una venta es un pedido entregado. La fecha de cada venta es la de creación del pedido en hora de Colombia.
      Total = productos + domicilios − descuentos. Los pedidos cancelados, anulados o sin cerrar no suman. Valores en pesos colombianos.
      Este documento es un control interno de ventas y no reemplaza la facturación electrónica.
    </footer>`;

  await document.fonts.ready;
  await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((ok) => { i.onload = i.onerror = ok; }))));
  return true;
};
