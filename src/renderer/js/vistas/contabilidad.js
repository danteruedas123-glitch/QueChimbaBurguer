/**
 * Contabilidad: ventas por período con comparación, gráficas y PDF.
 * Todas las cifras vienen calculadas por la base de datos (reporte_ventas).
 */
import { html, icono, pintar, avisar } from '../ui.js';
import { formatearCOP, variacion } from '../../../shared/dinero.js';
import { PERIODOS, rangoPeriodo, rangoAnterior, etiquetaRango, validarRango, hoyEn, fechaCorta, diaSemana } from '../../../shared/periodos.js';
import { ETIQUETA_PAGO, ETIQUETA_CANAL, ETIQUETA_ENTREGA } from '../../../shared/estados.js';
import { mensajeError } from '../../../shared/utilidades.js';
import { columnas, barrasHorizontales, activarTooltips } from '../graficas.js';

export async function montar(contenedor, ctx) {
  let periodo = 'hoy';
  let rango = rangoPeriodo('hoy');
  let datos = null;
  let anterior = null;
  let verTabla = false;

  activarTooltips(contenedor);

  async function cargar() {
    pintar(contenedor, html`${filtros()}<div class="vacio">Calculando…</div>`);
    try {
      [datos, anterior] = await Promise.all([
        ctx.api.reporte(rango.desde, rango.hasta),
        ctx.api.reporte(...Object.values(rangoAnterior(rango))),
      ]);
      pintarReporte();
    } catch (e) {
      pintar(contenedor, html`${filtros()}<div class="vacio">${mensajeError(e)}</div>`);
    }
  }

  function filtros() {
    return html`
      <div class="filtros-periodo">
        <div class="segmentado" role="group" aria-label="Período">
          ${PERIODOS.map((p) => html`<button type="button" data-periodo="${p.id}" aria-pressed="${periodo === p.id}">${p.nombre}</button>`)}
          <button type="button" data-periodo="personal" aria-pressed="${periodo === 'personal'}">Rango</button>
        </div>
        ${periodo === 'personal' ? html`
          <form class="rango-personal" data-rango>
            <input type="date" name="desde" value="${rango.desde}" max="${hoyEn()}" aria-label="Desde">
            <span>a</span>
            <input type="date" name="hasta" value="${rango.hasta}" max="${hoyEn()}" aria-label="Hasta">
            <button class="btn btn--sm" type="submit">Ver</button>
          </form>` : ''}
        <span class="etiqueta-rango">${etiquetaRango(rango)}</span>
        <button class="btn btn--primario" data-pdf ${datos ? '' : 'disabled'}>${icono('pdf')} Descargar PDF</button>
      </div>`;
  }

  const delta = (actual, previo) => {
    const v = variacion(actual, previo);
    if (v === null) return html`<span class="delta">Sin datos del período anterior</span>`;
    const cls = v > 0 ? 'sube' : v < 0 ? 'baja' : '';
    return html`<span class="delta ${cls}">${v > 0 ? icono('sube') : v < 0 ? icono('baja') : ''}${v > 0 ? '+' : ''}${v.toLocaleString('es-CO')} % vs. período anterior</span>`;
  };

  function pintarReporte() {
    const r = datos.resumen;
    const a = anterior.resumen;
    const unDia = rango.desde === rango.hasta;
    const horas = datos.por_hora.filter((h) => h.hora >= 10 || h.pedidos > 0);
    const desdeHora = Math.min(...horas.filter((h) => h.pedidos > 0).map((h) => h.hora), 11);
    const horasVisibles = datos.por_hora.filter((h) => h.hora >= desdeHora);

    pintar(contenedor, html`
      ${filtros()}
      <section class="kpis" aria-label="Resumen">
        <div class="kpi destacado"><span>Ventas</span><strong class="num" data-kpi="total">${formatearCOP(r.total)}</strong>${delta(r.total, a.total)}</div>
        <div class="kpi"><span>Pedidos</span><strong class="num" data-kpi="pedidos">${r.pedidos}</strong>${delta(r.pedidos, a.pedidos)}</div>
        <div class="kpi"><span>Ticket promedio</span><strong class="num">${formatearCOP(r.ticket_promedio)}</strong>${delta(r.ticket_promedio, a.ticket_promedio)}</div>
        <div class="kpi"><span>Productos vendidos</span><strong class="num">${r.unidades}</strong>${delta(r.unidades, a.unidades)}</div>
      </section>
      <div class="secundarios">
        <span>Productos: <b class="num">${formatearCOP(r.subtotal)}</b></span>
        <span>Domicilios: <b class="num">${formatearCOP(r.domicilios)}</b></span>
        <span>Descuentos: <b class="num">−${formatearCOP(r.descuentos)}</b></span>
        <span>Cancelados: <b class="num">${datos.cancelados.pedidos} (${formatearCOP(datos.cancelados.total)})</b></span>
        <span>Sin cerrar: <b class="num">${datos.pendientes.pedidos} (${formatearCOP(datos.pendientes.total)})</b></span>
      </div>

      <div class="rejilla-graficas">
        <section class="tarjeta ${unDia ? '' : 'ancha'}">
          <div class="tarjeta-cabeza">
            <h3>${unDia ? 'Ventas por hora' : 'Ventas por día'}</h3>
            <button class="btn btn--borde btn--sm alternar-tabla" data-tabla>${verTabla ? 'Ver gráfica' : 'Ver tabla'}</button>
          </div>
          <div class="tarjeta-cuerpo">
            ${verTabla ? tablaSerie(unDia ? horasVisibles.map((h) => ({ etiqueta: `${h.hora}:00`, ...h })) : datos.por_dia.map((d) => ({ etiqueta: `${diaSemana(d.fecha)} ${fechaCorta(d.fecha)}`, ...d })))
              : unDia
                ? columnas(horasVisibles.map((h) => ({ etiqueta: `${h.hora % 12 || 12}${h.hora < 12 ? 'a' : 'p'}`, detalle: `${h.hora}:00 – ${h.hora}:59`, valor: h.total, pedidos: h.pedidos })), { nombre: 'Ventas por hora' })
                : columnas(datos.por_dia.map((d) => ({ etiqueta: fechaCorta(d.fecha, { conAnio: false }), detalle: `${diaSemana(d.fecha)} ${fechaCorta(d.fecha)}`, valor: d.total, pedidos: d.pedidos })), { nombre: 'Ventas por día' })}
          </div>
        </section>
        ${unDia ? '' : html`
          <section class="tarjeta">
            <div class="tarjeta-cabeza"><h3>Ventas por hora</h3></div>
            <div class="tarjeta-cuerpo">${columnas(horasVisibles.map((h) => ({ etiqueta: `${h.hora % 12 || 12}${h.hora < 12 ? 'a' : 'p'}`, detalle: `${h.hora}:00 – ${h.hora}:59`, valor: h.total, pedidos: h.pedidos })), { alto: 210, nombre: 'Ventas por hora' })}</div>
          </section>`}
        <section class="tarjeta">
          <div class="tarjeta-cabeza"><h3>Métodos de pago</h3></div>
          <div class="tarjeta-cuerpo">${datos.por_metodo_pago.length
            ? barrasHorizontales(datos.por_metodo_pago, { etiqueta: (f) => ETIQUETA_PAGO[f.metodo], detalle: (f) => `${f.pedidos} pedidos · ${porcentaje(f.total, r.total)}` })
            : html`<p class="vacio">Sin ventas en este período.</p>`}</div>
        </section>
        <section class="tarjeta">
          <div class="tarjeta-cabeza"><h3>Canales y entrega</h3></div>
          <div class="tarjeta-cuerpo" style="display:grid;gap:18px">
            ${datos.por_canal.length ? barrasHorizontales(datos.por_canal, { etiqueta: (f) => ETIQUETA_CANAL[f.canal], detalle: (f) => `${f.pedidos} pedidos · ${porcentaje(f.total, r.total)}` }) : html`<p class="vacio">Sin ventas.</p>`}
            ${datos.por_entrega.length ? barrasHorizontales(datos.por_entrega, { etiqueta: (f) => ETIQUETA_ENTREGA[f.tipo], detalle: (f) => `${f.pedidos} pedidos` }) : ''}
          </div>
        </section>
        <section class="tarjeta ancha">
          <div class="tarjeta-cabeza"><h3>Productos más vendidos</h3></div>
          <div class="tarjeta-cuerpo">${datos.por_producto.length ? html`
            <table class="tabla">
              <thead><tr><th>#</th><th>Producto</th><th>Categoría</th><th class="der">Unidades</th><th class="der">Ventas</th><th class="der">% del total</th></tr></thead>
              <tbody>${datos.por_producto.slice(0, 15).map((p, i) => html`
                <tr><td class="num">${i + 1}</td><td><b>${p.nombre}</b></td><td>${p.categoria}</td>
                  <td class="der num">${p.unidades}</td><td class="der num"><b>${formatearCOP(p.total)}</b></td><td class="der num">${porcentaje(p.total, r.subtotal)}</td></tr>`)}
              </tbody>
            </table>` : html`<p class="vacio">Sin ventas en este período.</p>`}</div>
        </section>
      </div>`);
  }

  const porcentaje = (parte, total) => (total ? `${((parte / total) * 100).toLocaleString('es-CO', { maximumFractionDigits: 1 })} %` : '0 %');

  function tablaSerie(filas) {
    return html`<div class="tabla-datos"><table class="tabla">
      <thead><tr><th>${rango.desde === rango.hasta ? 'Hora' : 'Día'}</th><th class="der">Pedidos</th><th class="der">Ventas</th></tr></thead>
      <tbody>${filas.map((f) => html`<tr><td>${f.etiqueta}</td><td class="der num">${f.pedidos}</td><td class="der num">${formatearCOP(f.total)}</td></tr>`)}</tbody>
    </table></div>`;
  }

  contenedor.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-periodo],[data-pdf],[data-tabla]');
    if (!t) return;
    if (t.dataset.periodo) {
      periodo = t.dataset.periodo;
      if (periodo === 'personal') {
        datos ? pintarReporte() : cargar();
        return;
      }
      rango = rangoPeriodo(periodo);
      await cargar();
    } else if (t.hasAttribute('data-tabla')) {
      verTabla = !verTabla;
      pintarReporte();
    } else if (t.hasAttribute('data-pdf')) {
      t.disabled = true;
      try {
        const r = await window.qb.pdf.reporte({ reporte: datos, anterior, generado: new Date().toISOString() });
        if (r?.ruta) avisar(html`PDF guardado en <b>${r.ruta}</b>`, 'ok', 6000);
        else if (r?.error) avisar(r.error, 'error');
      } finally {
        t.disabled = false;
      }
    }
  });

  contenedor.addEventListener('submit', async (e) => {
    if (!e.target.matches('[data-rango]')) return;
    e.preventDefault();
    const nuevo = { desde: e.target.desde.value, hasta: e.target.hasta.value };
    const error = validarRango(nuevo);
    if (error) { avisar(error, 'error'); return; }
    rango = nuevo;
    await cargar();
  });

  await cargar();
  return () => {};
}

