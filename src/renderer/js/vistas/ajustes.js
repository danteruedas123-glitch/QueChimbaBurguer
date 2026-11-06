/** Ajustes del negocio y de la app. */
import { html, pintar, avisar, confirmar, $ } from '../ui.js';
import { mensajeError } from '../../../shared/utilidades.js';

export async function montar(contenedor, ctx) {
  const menu = await ctx.api.menu();
  const a = menu.ajustes;
  const actualizacion = await window.qb.actualizador.estado();
  const sonido = localStorage.getItem('qb-sonido') !== 'off';

  pintar(contenedor, html`
    <div class="ajustes">
      <section class="tarjeta"><div class="tarjeta-cuerpo ajuste">
        <h3>Página web</h3>
        <div class="estado-web" data-estado-web></div>
        <p>Al cerrar el negocio, desactiva la web: los clientes verán que el local está cerrado y no podrán hacer pedidos ni escribir por WhatsApp desde la página. Al abrir, actívala de nuevo.</p>
        <div class="ajuste-fila">
          <p>Sonido cuando llega un pedido nuevo.</p>
          <label class="interruptor"><input type="checkbox" data-sonido ${sonido ? 'checked' : ''} aria-label="Sonido de pedidos"> Sonido</label>
        </div>
      </div></section>

      <section class="tarjeta"><form class="tarjeta-cuerpo ajuste" data-destacado>
        <h3>Producto destacado en la web</h3>
        <p>Aparece en la franja roja de la página principal.</p>
        <label class="campo"><span>Producto</span><select name="producto">
          <option value="">— Ninguno (ocultar la franja) —</option>
          ${menu.productos.filter((p) => p.activo).map((p) => html`<option value="${p.id}" ${p.id === a.producto_destacado_id ? 'selected' : ''}>${p.nombre}</option>`)}
        </select></label>
        <label class="campo"><span>Título pequeño</span><input name="titulo" maxlength="40" value="${a.titulo_destacado}"></label>
        <button class="btn btn--primario" type="submit" style="justify-self:start">Guardar destacado</button>
      </form></section>

      <section class="tarjeta"><div class="tarjeta-cuerpo ajuste">
        <h3>Actualizaciones</h3>
        <p>Versión instalada: <b>${actualizacion.version}</b>. Las actualizaciones se descargan solas y se instalan al cerrar la app.</p>
        <p data-update-estado>${textoActualizacion(actualizacion)}</p>
        <button class="btn btn--borde" data-buscar-update style="justify-self:start">Buscar actualizaciones</button>
      </div></section>

      <section class="tarjeta"><form class="tarjeta-cuerpo ajuste" data-tecnico>
        <h3>Datos técnicos</h3>
        <label class="campo"><span>Dirección del sitio web</span><input name="url" value="${a.url_sitio}" placeholder="https://quechimbaburger.com/">
          <small>Se usa para mostrar en la app las fotos que están guardadas en la web.</small></label>
        <label class="campo"><span>Versión mínima de la app</span><input name="version" value="${a.version_minima_escritorio}" pattern="\\d+\\.\\d+\\.\\d+">
          <small>Si una versión anterior tiene un error grave, súbela para obligar a actualizar.</small></label>
        <p>Conexión: <span class="dato-tecnico">${ctx.config.modoDemo ? 'Modo demo (base local)' : ctx.config.supabaseUrl}</span></p>
        <button class="btn btn--borde" type="submit" style="justify-self:start">Guardar</button>
      </form></section>
    </div>`);

  const guardar = async (p, mensaje) => {
    try {
      await ctx.api.guardarAjustes(p);
      avisar(mensaje);
      return true;
    } catch (e) {
      avisar(mensajeError(e), 'error');
      return false;
    }
  };

  // ---------- Web activada / desactivada ----------
  let webActiva = a.pedidos_web_activos;
  const pintarEstadoWeb = () => {
    pintar($('[data-estado-web]', contenedor), html`
      <div class="estado-web-fila ${webActiva ? 'activa' : 'inactiva'}">
        <span class="estado-web-punto" aria-hidden="true"></span>
        <div><b data-web-texto>${webActiva ? 'Web activada' : 'Web desactivada'}</b>
          <small>${webActiva ? 'Los clientes pueden hacer pedidos por la página y por WhatsApp.' : 'La página muestra "cerrado" y no recibe pedidos.'}</small></div>
      </div>
      <button type="button" class="btn btn--lg ${webActiva ? 'btn--peligro' : 'btn--primario'}" data-web>${webActiva ? 'Desactivar web' : 'Activar web'}</button>`);
  };
  pintarEstadoWeb();
  contenedor.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-web]');
    if (!b) return;
    const nueva = !webActiva;
    if (!nueva) {
      const ok = await confirmar('Desactivar la web',
        'Los clientes no podrán hacer pedidos ni escribir por WhatsApp desde la página hasta que la vuelvas a activar. ¿Continuar?',
        { aceptar: 'Desactivar web', peligro: true });
      if (!ok) return;
    }
    b.disabled = true;
    if (await guardar({ pedidos_web_activos: nueva }, nueva ? 'Web activada: ya se reciben pedidos' : 'Web desactivada: no se reciben pedidos')) {
      webActiva = nueva;
      ctx.estadoWeb(webActiva);
    }
    pintarEstadoWeb();
  });
  $('[data-sonido]', contenedor).addEventListener('change', (e) => {
    localStorage.setItem('qb-sonido', e.target.checked ? 'on' : 'off');
  });
  $('[data-destacado]', contenedor).addEventListener('submit', (e) => {
    e.preventDefault();
    guardar({ producto_destacado_id: e.target.producto.value || null, titulo_destacado: e.target.titulo.value }, 'Destacado actualizado en la web');
  });
  $('[data-tecnico]', contenedor).addEventListener('submit', (e) => {
    e.preventDefault();
    guardar({ url_sitio: e.target.url.value.trim(), version_minima_escritorio: e.target.version.value.trim() }, 'Datos técnicos guardados');
  });
  $('[data-buscar-update]', contenedor).addEventListener('click', async () => {
    $('[data-update-estado]', contenedor).textContent = textoActualizacion(await window.qb.actualizador.buscar());
  });
  const off = window.qb.actualizador.alCambiar((e) => {
    const el = $('[data-update-estado]', contenedor);
    if (el) el.textContent = textoActualizacion(e);
  });
  return off;
}

function textoActualizacion(e) {
  return {
    desarrollo: 'Modo desarrollo: las actualizaciones automáticas funcionan en la versión instalada.',
    inactivo: 'Aún no se ha buscado.',
    buscando: 'Buscando actualizaciones…',
    'al-dia': 'Tienes la versión más reciente.',
    descargando: `Descargando la versión ${e.nueva ?? ''}… ${e.progreso ?? 0}%`,
    lista: `La versión ${e.nueva} está lista: se instalará al cerrar la app.`,
    error: `No se pudo buscar: ${e.mensaje ?? 'sin conexión'}`,
  }[e.estado] ?? '';
}
