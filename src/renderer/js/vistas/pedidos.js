/**
 * Tablero de pedidos en vivo.
 * Un "monitor" único escucha la base de datos (Realtime + consulta de
 * respaldo cada 20 s) aunque el encargado esté en otra sección, para no
 * perder ningún pedido: suena, notifica y actualiza el contador.
 */
import { html, icono, pintar, avisar, modal, sonarNuevoPedido, agrupar, $ } from '../ui.js';
import { formatearCOP, parsearCOP } from '../../../shared/dinero.js';
import { hoyEn, sumarDias, horaLocal } from '../../../shared/periodos.js';
import { siguienteEstado, ETIQUETA_CANAL, ETIQUETA_ENTREGA, ETIQUETA_PAGO, ETIQUETA_ESTADO, PAGOS_ACTIVOS } from '../../../shared/estados.js';
import { mensajeError } from '../../../shared/utilidades.js';

const ACCION = { nuevo: 'Empezar a preparar', preparando: 'Marcar listo', listo: 'Entregar' };
const COLUMNAS = [['nuevo', 'Nuevos'], ['preparando', 'En preparación'], ['listo', 'Listos']];
export const numeroPedido = (n) => `#${String(n).padStart(4, '0')}`;

// ---------- Monitor en segundo plano ----------
const monitor = { ctx: null, pedidos: [], conocidos: null, oyentes: new Set(), recienLlegados: new Set(), activo: false };

async function refrescar() {
  const { ctx } = monitor;
  try {
    const hoy = hoyEn();
    const lista = await ctx.api.pedidos(sumarDias(hoy, -1), hoy);
    const nuevosWeb = monitor.conocidos
      ? lista.filter((p) => !monitor.conocidos.has(p.id) && p.canal === 'web' && p.estado === 'nuevo')
      : [];
    monitor.conocidos = new Set(lista.map((p) => p.id));
    monitor.pedidos = lista;
    if (nuevosWeb.length) alertarNuevos(nuevosWeb);
    ctx.contadorPedidos(lista.filter((p) => p.estado === 'nuevo').length);
    monitor.oyentes.forEach((f) => f());
  } catch (e) {
    ctx.estadoConexion('caida');
    console.warn('No se pudieron cargar los pedidos', e);
  }
}

function alertarNuevos(nuevos) {
  nuevos.forEach((p) => monitor.recienLlegados.add(p.id));
  setTimeout(() => nuevos.forEach((p) => monitor.recienLlegados.delete(p.id)), 60_000);
  sonarNuevoPedido();
  const p = nuevos[0];
  const titulo = nuevos.length === 1 ? `Nuevo pedido web ${numeroPedido(p.numero)}` : `${nuevos.length} pedidos web nuevos`;
  window.qb.notificar(titulo, `${p.cliente_nombre} · ${formatearCOP(p.total)} · ${ETIQUETA_ENTREGA[p.tipo_entrega]}`);
  avisar(html`<b>${titulo}</b> · ${p.cliente_nombre}`, 'ok', 6000);
}

export function escucharEnFondo(ctx) {
  if (monitor.activo) return;
  monitor.activo = true;
  monitor.ctx = ctx;
  const refrescarAgrupado = agrupar(refrescar, 250);
  ctx.api.fuente.suscribirPedidos(refrescarAgrupado, (estado) => ctx.estadoConexion(estado));
  setInterval(refrescar, 20_000);
  refrescar();
}

// ---------- Vista ----------
export async function montar(contenedor, ctx) {
  escucharEnFondo(ctx);
  const pintarTablero = () => pintar(contenedor, tablero());
  monitor.oyentes.add(pintarTablero);
  pintarTablero();
  if (!monitor.conocidos) await refrescar();

  contenedor.addEventListener('click', manejarClic);
  return () => {
    monitor.oyentes.delete(pintarTablero);
    contenedor.removeEventListener('click', manejarClic);
  };

  async function manejarClic(e) {
    const b = e.target.closest('[data-accion]');
    if (!b) return;
    const pedido = monitor.pedidos.find((p) => p.id === b.dataset.id);
    if (!pedido) return;
    try {
      switch (b.dataset.accion) {
        case 'avanzar': await avanzar(ctx, pedido); break;
        case 'cobro': await editarCobro(ctx, pedido); break;
        case 'cancelar': await cancelar(ctx, pedido); break;
        case 'whatsapp': abrirWhatsApp(pedido); break;
        default: return;
      }
    } catch (err) {
      avisar(mensajeError(err), 'error');
    }
  }
}

function tablero() {
  const hoy = hoyEn();
  const delDia = (p) => hoyEn(undefined, new Date(p.creado_en)) === hoy;
  const activos = monitor.pedidos.filter((p) => !['entregado', 'cancelado'].includes(p.estado));
  const cerrados = monitor.pedidos.filter((p) => ['entregado', 'cancelado'].includes(p.estado) && delDia(p));
  const vendidoHoy = cerrados.filter((p) => p.estado === 'entregado').reduce((s, p) => s + p.total, 0);

  if (!monitor.conocidos) return html`<div class="vacio">Cargando pedidos…</div>`;
  return html`
    <div class="tablero">
      ${COLUMNAS.map(([estado, titulo]) => {
        const lista = activos.filter((p) => p.estado === estado).sort((a, b) => a.creado_en.localeCompare(b.creado_en));
        return html`
          <section class="columna" aria-label="${titulo}" data-columna="${estado}">
            <div class="columna-cabeza"><h2>${titulo}</h2><span class="chip">${lista.length}</span></div>
            ${lista.length ? lista.map(tarjetaPedido) : html`<p class="columna-vacia">${estado === 'nuevo' ? 'Sin pedidos nuevos por ahora.' : 'Nada aquí.'}</p>`}
          </section>`;
      })}
      <section class="columna columna--cerrados" aria-label="Cerrados hoy">
        <div class="columna-cabeza"><h2>Cerrados hoy</h2><span class="chip">${cerrados.length}</span></div>
        <div class="cerrados-resumen"><span>Vendido hoy</span><strong class="num" data-vendido-hoy>${formatearCOP(vendidoHoy)}</strong></div>
        ${cerrados.length ? cerrados.map((p) => html`
          <div class="cerrado ${p.estado === 'cancelado' ? 'es-cancelado' : ''}">
            <b>${numeroPedido(p.numero)}</b>
            <span>${horaLocal(p.creado_en)} · ${ETIQUETA_CANAL[p.canal]}${p.estado === 'cancelado' ? ' · Cancelado' : ''}</span>
            <span class="monto num">${formatearCOP(p.total)}</span>
            ${p.estado === 'entregado' ? html`<button class="btn-icono btn-icono--peligro" data-accion="cancelar" data-id="${p.id}" title="Anular venta" aria-label="Anular venta ${numeroPedido(p.numero)}">${icono('x')}</button>` : ''}
          </div>`) : html`<p class="columna-vacia">Aún no hay ventas cerradas hoy.</p>`}
      </section>
    </div>`;
}

function tarjetaPedido(p) {
  const sig = siguienteEstado(p.estado);
  return html`
    <article class="pedido ${monitor.recienLlegados.has(p.id) ? 'es-nuevo' : ''}" data-pedido="${p.numero}">
      <div class="pedido-cabeza">
        <span class="pedido-numero">${numeroPedido(p.numero)}</span>
        <span class="pedido-hora">${horaLocal(p.creado_en)}</span>
        <span class="chip chip--${p.canal}">${ETIQUETA_CANAL[p.canal]}</span>
      </div>
      <div class="pedido-cliente">
        <b>${p.cliente_nombre || 'Cliente sin nombre'}</b>
        <span>${icono(p.tipo_entrega === 'domicilio' ? 'moto' : p.tipo_entrega === 'recoger' ? 'bolsa' : 'mesa')}
          ${ETIQUETA_ENTREGA[p.tipo_entrega]}${p.direccion ? ` · ${p.direccion}` : ''}</span>
      </div>
      <ul class="pedido-items">
        ${p.items.map((i) => html`<li><b>${i.cantidad}×</b><span>${i.nombre}</span></li>`)}
      </ul>
      ${p.notas ? html`<p class="pedido-notas">📝 ${p.notas}</p>` : ''}
      <div class="pedido-pie">
        <div class="pedido-total num">${formatearCOP(p.total)}
          <small>${ETIQUETA_PAGO[p.metodo_pago]}${p.costo_domicilio ? ` · domicilio ${formatearCOP(p.costo_domicilio)}` : p.tipo_entrega === 'domicilio' ? ' · falta domicilio' : ''}</small>
        </div>
        ${p.cliente_telefono ? html`<button class="btn-icono" data-accion="whatsapp" data-id="${p.id}" title="Escribir al cliente" aria-label="Escribir por WhatsApp a ${p.cliente_nombre}">${icono('wa')}</button>` : ''}
        <button class="btn-icono" data-accion="cobro" data-id="${p.id}" title="Domicilio, descuento y pago" aria-label="Editar cobro del pedido ${numeroPedido(p.numero)}">${icono('editar')}</button>
        <button class="btn-icono btn-icono--peligro" data-accion="cancelar" data-id="${p.id}" title="Cancelar pedido" aria-label="Cancelar pedido ${numeroPedido(p.numero)}">${icono('x')}</button>
      </div>
      ${sig ? html`<button class="btn ${sig === 'entregado' ? 'btn--primario' : ''} btn--bloque" data-accion="avanzar" data-id="${p.id}">${ACCION[p.estado]} ${icono('flecha')}</button>` : ''}
    </article>`;
}

// ---------- Acciones ----------
async function avanzar(ctx, p) {
  const sig = siguienteEstado(p.estado);
  // Antes de entregar un domicilio sin tarifa, confirmar el cobro para que la contabilidad sea exacta
  if (sig === 'entregado' && p.tipo_entrega === 'domicilio' && p.costo_domicilio === 0) {
    const ok = await editarCobro(ctx, p, { titulo: `Entregar ${numeroPedido(p.numero)}`, aceptar: 'Guardar y entregar' });
    if (!ok) return;
  }
  await ctx.api.cambiarEstado(p.id, sig);
  avisar(html`${numeroPedido(p.numero)} → <b>${ETIQUETA_ESTADO[sig]}</b>`);
  await refrescar();
}

function editarCobro(ctx, p, { titulo = `Cobro del pedido ${numeroPedido(p.numero)}`, aceptar = 'Guardar' } = {}) {
  return modal({
    titulo,
    aceptar,
    contenido: html`
      <p>Subtotal de productos: <b class="num">${formatearCOP(p.subtotal)}</b></p>
      <div class="fila-campos">
        <label class="campo"><span>Domicilio</span><input name="domicilio" inputmode="numeric" value="${p.costo_domicilio || ''}" placeholder="0"></label>
        <label class="campo"><span>Descuento</span><input name="descuento" inputmode="numeric" value="${p.descuento || ''}" placeholder="0"></label>
      </div>
      <label class="campo"><span>Método de pago</span>
        <select name="pago">${[...new Set([...PAGOS_ACTIVOS, p.metodo_pago])].map((v) => html`<option value="${v}" ${v === p.metodo_pago ? 'selected' : ''}>${ETIQUETA_PAGO[v]}</option>`)}</select>
      </label>
      <p>Total a cobrar: <b class="num" data-total>${formatearCOP(p.total)}</b></p>`,
    alAbrir: (d) => {
      const f = d.querySelector('form');
      const actualizar = () => {
        const dom = parsearCOP(f.domicilio.value || '0') ?? 0;
        const des = parsearCOP(f.descuento.value || '0') ?? 0;
        $('[data-total]', d).textContent = formatearCOP(p.subtotal + dom - des);
      };
      f.addEventListener('input', actualizar);
      f.domicilio.focus();
    },
    alAceptar: async (f) => {
      const dom = parsearCOP(f.domicilio.value || '0');
      const des = parsearCOP(f.descuento.value || '0');
      if (dom === null || des === null) throw new Error('Escribe valores en pesos, sin decimales (ej. 4.000)');
      await ctx.api.actualizarCobro(p.id, { costo_domicilio: dom, descuento: des, metodo_pago: f.pago.value });
      await refrescar();
      return true;
    },
  });
}

function cancelar(ctx, p) {
  const anulacion = p.estado === 'entregado';
  return modal({
    titulo: anulacion ? `Anular venta ${numeroPedido(p.numero)}` : `Cancelar pedido ${numeroPedido(p.numero)}`,
    aceptar: anulacion ? 'Anular venta' : 'Cancelar pedido',
    cancelar: 'Volver',
    peligro: true,
    contenido: html`
      <p>${anulacion
        ? `Esta venta de ${formatearCOP(p.total)} dejará de contar en la contabilidad. Queda registrado quién la anuló y por qué.`
        : 'El pedido no contará como venta.'}</p>
      <label class="campo"><span>Motivo ${anulacion ? '' : html`<em>(opcional)</em>`}</span>
        <input name="motivo" maxlength="200" ${anulacion ? 'required' : ''} placeholder="Ej: el cliente no contestó"></label>`,
    alAceptar: async (f) => {
      const motivo = f.motivo.value.trim();
      if (anulacion && motivo.length < 3) throw new Error('Escribe el motivo de la anulación');
      await ctx.api.cambiarEstado(p.id, 'cancelado', motivo || null);
      avisar(html`${numeroPedido(p.numero)} <b>${anulacion ? 'anulado' : 'cancelado'}</b>`);
      await refrescar();
      return true;
    },
  });
}

function abrirWhatsApp(p) {
  let tel = p.cliente_telefono.replace(/\D/g, '');
  if (tel.length === 10) tel = `57${tel}`;
  const texto = `¡Hola ${p.cliente_nombre}! Te escribimos de Quechimba Burger sobre tu pedido ${numeroPedido(p.numero)} 🍔`;
  window.qb.abrirExterno(`https://wa.me/${tel}?text=${encodeURIComponent(texto)}`);
}
