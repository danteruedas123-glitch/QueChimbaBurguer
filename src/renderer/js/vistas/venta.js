/**
 * Caja: registrar ventas del local o de WhatsApp (que no pasan por la web),
 * para que la contabilidad quede completa.
 */
import { html, icono, pintar, avisar, $ } from '../ui.js';
import { formatearCOP, parsearCOP } from '../../../shared/dinero.js';
import { ETIQUETA_PAGO } from '../../../shared/estados.js';
import { calcularTicket, mensajeError } from '../../../shared/utilidades.js';
import { urlFoto } from '../datos.js';
import { numeroPedido } from './pedidos.js';

const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export async function montar(contenedor, ctx) {
  const menu = await ctx.api.menu();
  const urlSitio = menu.ajustes?.url_sitio ?? '';
  const productos = menu.productos;
  const porId = new Map(productos.map((p) => [p.id, p]));
  const categorias = menu.categorias.filter((c) => productos.some((p) => p.categoria_id === c.id));

  const estado = {
    filtro: 'todas',
    busqueda: '',
    lineas: new Map(), // id → cantidad
    canal: 'local',
    entrega: 'en_local',
    pago: 'efectivo',
    entregado: true,
  };

  pintar(contenedor, html`
    <div class="caja">
      <section class="caja-productos" aria-label="Productos">
        <div class="caja-filtros">
          <label class="buscador">${icono('buscar')}<span class="visualmente-oculto">Buscar</span><input data-buscar placeholder="Buscar producto…" autocomplete="off"></label>
        </div>
        <div class="pestanas" role="group" aria-label="Categorías" data-pestanas></div>
        <div class="rejilla-productos" data-rejilla></div>
      </section>
      <aside class="ticket" aria-label="Venta actual">
        <div class="ticket-cabeza"><h2>Venta</h2><button class="btn btn--borde btn--sm" data-limpiar>Limpiar</button></div>
        <div class="ticket-cuerpo">
          <div class="lineas-ticket" data-lineas></div>
          <div class="opciones"><span>Canal</span><div class="segmentado" data-grupo="canal">
            <button type="button" data-valor="local">${icono('mesa')} Local</button>
            <button type="button" data-valor="whatsapp">${icono('wa')} WhatsApp</button></div></div>
          <div class="opciones"><span>Entrega</span><div class="segmentado" data-grupo="entrega">
            <button type="button" data-valor="en_local">En el local</button>
            <button type="button" data-valor="recoger">Recoger</button>
            <button type="button" data-valor="domicilio">Domicilio</button></div></div>
          <label class="campo"><span>Método de pago</span><select data-pago>
            ${Object.entries(ETIQUETA_PAGO).map(([v, t]) => html`<option value="${v}">${t}</option>`)}</select></label>
          <div class="fila-campos">
            <label class="campo"><span>Cliente <em>(opcional)</em></span><input data-cliente maxlength="60"></label>
            <label class="campo"><span>Teléfono <em>(opcional)</em></span><input data-telefono maxlength="20" inputmode="tel"></label>
          </div>
          <label class="campo" data-solo-domicilio hidden><span>Dirección</span><input data-direccion maxlength="140"></label>
          <div class="fila-campos">
            <label class="campo" data-solo-domicilio hidden><span>Domicilio</span><input data-domicilio inputmode="numeric" placeholder="0"></label>
            <label class="campo"><span>Descuento</span><input data-descuento inputmode="numeric" placeholder="0"></label>
          </div>
          <label class="campo"><span>Notas <em>(opcional)</em></span><input data-notas maxlength="240" placeholder="Ej: sin cebolla"></label>
        </div>
        <div class="ticket-pie">
          <div class="totales">
            <div><span>Subtotal</span><span class="num" data-subtotal>$0</span></div>
            <div class="grande"><span>Total</span><strong class="num" data-total>$0</strong></div>
          </div>
          <label class="interruptor"><input type="checkbox" data-entregado checked> Pagada y entregada (si no, va a cocina)</label>
          <p class="error-form" data-error hidden></p>
          <button class="btn btn--primario btn--lg btn--bloque" data-registrar disabled>Registrar venta</button>
        </div>
      </aside>
    </div>`);

  const el = {
    pestanas: $('[data-pestanas]', contenedor), rejilla: $('[data-rejilla]', contenedor), lineas: $('[data-lineas]', contenedor),
    subtotal: $('[data-subtotal]', contenedor), total: $('[data-total]', contenedor), error: $('[data-error]', contenedor),
    registrar: $('[data-registrar]', contenedor), descuento: $('[data-descuento]', contenedor), domicilio: $('[data-domicilio]', contenedor),
  };

  function pintarPestanas() {
    pintar(el.pestanas, html`
      <button type="button" data-cat="todas" aria-pressed="${estado.filtro === 'todas'}">Todo</button>
      ${categorias.map((c) => html`<button type="button" data-cat="${c.id}" aria-pressed="${estado.filtro === c.id}">${c.nombre}</button>`)}`);
  }

  function pintarRejilla() {
    const q = normalizar(estado.busqueda);
    const visibles = productos.filter((p) => (estado.filtro === 'todas' || p.categoria_id === estado.filtro)
      && (!q || normalizar(`${p.nombre} ${p.descripcion}`).includes(q)));
    pintar(el.rejilla, visibles.length ? html`${visibles.map((p) => html`
      <button type="button" class="producto-btn ${p.agotado ? 'agotado' : ''}" data-producto="${p.id}" aria-label="Agregar ${p.nombre}, ${formatearCOP(p.precio)}">
        <img src="${urlFoto(p.foto_url, urlSitio)}" alt="" loading="lazy" data-foto>
        <div><b>${p.nombre}</b><span class="num">${formatearCOP(p.precio)}</span></div>
        ${estado.lineas.get(p.id) ? html`<span class="cantidad">${estado.lineas.get(p.id)}</span>` : ''}
      </button>`)}` : html`<p class="vacio">No hay productos que coincidan.</p>`);
  }

  function valoresCobro() {
    const domicilio = estado.entrega === 'domicilio' ? parsearCOP(el.domicilio.value || '0') : 0;
    const descuento = parsearCOP(el.descuento.value || '0');
    return { domicilio, descuento };
  }

  function pintarTicket() {
    const lineas = [...estado.lineas].map(([id, cantidad]) => ({ p: porId.get(id), cantidad }));
    pintar(el.lineas, lineas.length ? html`${lineas.map(({ p, cantidad }) => html`
      <div class="linea">
        <div><b>${p.nombre}</b><small class="num">${formatearCOP(p.precio)} c/u</small></div>
        <div class="paso" role="group" aria-label="Cantidad de ${p.nombre}">
          <button type="button" data-menos="${p.id}" aria-label="Quitar uno">${icono('menos')}</button>
          <output>${cantidad}</output>
          <button type="button" data-mas="${p.id}" aria-label="Agregar uno">${icono('mas')}</button>
        </div>
        <span class="linea-total num">${formatearCOP(p.precio * cantidad)}</span>
      </div>`)}` : html`<p class="vacio">Toca un producto para agregarlo.</p>`);

    el.error.hidden = true;
    const { domicilio, descuento } = valoresCobro();
    let ok = lineas.length > 0;
    try {
      if (domicilio === null || descuento === null) throw new Error('Escribe valores en pesos, sin decimales (ej. 4.000)');
      const t = calcularTicket(lineas.map(({ p, cantidad }) => ({ precio: p.precio, cantidad })), { domicilio, descuento });
      el.subtotal.textContent = formatearCOP(t.subtotal);
      el.total.textContent = formatearCOP(t.total);
      el.registrar.textContent = lineas.length ? `Registrar venta · ${formatearCOP(t.total)}` : 'Registrar venta';
    } catch (e) {
      ok = false;
      el.error.textContent = e.message;
      el.error.hidden = false;
    }
    el.registrar.disabled = !ok;
  }

  function pintarOpciones() {
    contenedor.querySelectorAll('[data-grupo]').forEach((g) => {
      g.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(estado[g.dataset.grupo] === b.dataset.valor)));
    });
    contenedor.querySelectorAll('[data-solo-domicilio]').forEach((x) => { x.hidden = estado.entrega !== 'domicilio'; });
  }

  function cambiar(id, delta) {
    const n = Math.max(0, Math.min(99, (estado.lineas.get(id) ?? 0) + delta));
    if (n) estado.lineas.set(id, n); else estado.lineas.delete(id);
    pintarTicket();
    pintarRejilla();
  }

  function limpiar() {
    estado.lineas.clear();
    contenedor.querySelectorAll('.ticket input:not([type=checkbox])').forEach((i) => { i.value = ''; });
    pintarTicket();
    pintarRejilla();
  }

  contenedor.addEventListener('click', (e) => {
    const t = e.target.closest('[data-producto],[data-mas],[data-menos],[data-cat],[data-grupo] button,[data-limpiar]');
    if (!t) return;
    if (t.dataset.producto) cambiar(t.dataset.producto, 1);
    else if (t.dataset.mas) cambiar(t.dataset.mas, 1);
    else if (t.dataset.menos) cambiar(t.dataset.menos, -1);
    else if (t.dataset.cat) { estado.filtro = t.dataset.cat; pintarPestanas(); pintarRejilla(); }
    else if (t.hasAttribute('data-limpiar')) limpiar();
    else {
      const grupo = t.closest('[data-grupo]').dataset.grupo;
      estado[grupo] = t.dataset.valor;
      if (grupo === 'canal' && estado.canal === 'whatsapp' && estado.entrega === 'en_local') estado.entrega = 'domicilio';
      pintarOpciones();
      pintarTicket();
    }
  });
  contenedor.addEventListener('input', (e) => {
    if (e.target.matches('[data-buscar]')) { estado.busqueda = e.target.value; pintarRejilla(); }
    if (e.target.matches('[data-descuento],[data-domicilio]')) pintarTicket();
  });
  $('[data-pago]', contenedor).addEventListener('change', (e) => { estado.pago = e.target.value; });
  $('[data-entregado]', contenedor).addEventListener('change', (e) => { estado.entregado = e.target.checked; });
  contenedor.addEventListener('error', (e) => { if (e.target.matches?.('[data-foto]')) e.target.src = 'img/logo.webp'; }, true);

  el.registrar.addEventListener('click', async () => {
    const { domicilio, descuento } = valoresCobro();
    el.registrar.disabled = true;
    try {
      const v = await ctx.api.registrarVenta(
        [...estado.lineas].map(([producto_id, cantidad]) => ({ producto_id, cantidad })),
        {
          canal: estado.canal, tipo_entrega: estado.entrega, metodo_pago: estado.pago,
          cliente_nombre: $('[data-cliente]', contenedor).value, cliente_telefono: $('[data-telefono]', contenedor).value,
          direccion: estado.entrega === 'domicilio' ? $('[data-direccion]', contenedor).value : '',
          notas: $('[data-notas]', contenedor).value, costo_domicilio: domicilio, descuento, entregado: estado.entregado,
        },
      );
      avisar(html`Venta <b>${numeroPedido(v.numero)}</b> registrada · ${formatearCOP(v.total)}${v.estado === 'nuevo' ? ' · enviada a cocina' : ''}`);
      limpiar();
    } catch (e) {
      el.error.textContent = mensajeError(e);
      el.error.hidden = false;
      el.registrar.disabled = false;
    }
  });

  pintarPestanas();
  pintarRejilla();
  pintarOpciones();
  pintarTicket();
  $('[data-buscar]', contenedor).focus();
}
