/** Ajustes del negocio y de la app. */
import { html, pintar, avisar, confirmar, modal, $ } from '../ui.js';
import { mensajeError } from '../../../shared/utilidades.js';
import { FESTIVIDADES, MESES_LARGOS, DIAS_ANIVERSARIO, proximoAniversario } from '../../../shared/festividades.js';
import { hoyEn, fechaCorta } from '../../../shared/periodos.js';

export async function montar(contenedor, ctx) {
  const menu = await ctx.api.menu();
  const a = menu.ajustes;
  const actualizacion = await window.qb.actualizador.estado();
  const sonido = localStorage.getItem('qb-sonido') !== 'off';
  let festHoy = await ctx.api.festividadHoy().catch(() => ({ tema: 'normal' }));

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

      <section class="tarjeta tarjeta--ancha" data-festividades></section>

      <section class="tarjeta"><form class="tarjeta-cuerpo ajuste" data-destacado>
        <h3>Portada de la web</h3>
        <p>El plato que elijas sale grande al inicio de la página, con su foto, su nombre y su precio. Al tocarlo, el cliente lo agrega a su pedido.</p>
        <label class="campo"><span>Plato de la portada</span><select name="producto">
          <option value="">— Ninguno (foto de la marca) —</option>
          ${menu.productos.filter((p) => p.activo).map((p) => html`<option value="${p.id}" ${p.id === a.producto_destacado_id ? 'selected' : ''}>${p.nombre}</option>`)}
        </select></label>
        <label class="campo"><span>Frase pequeña</span><input name="titulo" maxlength="40" value="${a.titulo_destacado}" placeholder="Ej: La más pedida"></label>
        <button class="btn btn--primario" type="submit" style="justify-self:start">Guardar portada</button>
      </form></section>

      <section class="tarjeta"><form class="tarjeta-cuerpo ajuste" data-bebidas>
        <h3>Bebidas para elegir</h3>
        <p>Las que el cliente puede escoger en los combos que traen gaseosa y en las micheladas. Una por línea.</p>
        <div class="fila-campos">
          <label class="campo"><span>Gaseosas</span><textarea name="gaseosas" rows="6">${(a.bebidas_gaseosa ?? []).join('\n')}</textarea></label>
          <label class="campo"><span>Para micheladas</span><textarea name="micheladas" rows="6">${(a.bebidas_michelada ?? []).join('\n')}</textarea></label>
        </div>
        <button class="btn btn--primario" type="submit" style="justify-self:start">Guardar bebidas</button>
      </form></section>

      <section class="tarjeta"><div class="tarjeta-cuerpo ajuste">
        <h3>Actualizaciones</h3>
        <p>Versión instalada: <b>${actualizacion.version}</b>. ${actualizacion.plataforma === 'linux'
          ? 'La app revisa sola si hay versión nueva y te avisa para descargarla.'
          : 'Las actualizaciones se descargan solas y se instalan al cerrar la app.'}</p>
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

  // ---------- Festividades y aniversario ----------
  let aj = a;
  const anios = (n) => `${n} ${n === 1 ? 'año' : 'años'}`;
  const pintarFestividades = () => {
    const aniv = aj.aniversario_mes ? { dia: aj.aniversario_dia, mes: aj.aniversario_mes, fundacion: aj.aniversario_fundacion } : null;
    const prox = aniv ? proximoAniversario(aniv, hoyEn()) : null;
    const hoyF = FESTIVIDADES.find((f) => f.id === festHoy?.tema) ?? FESTIVIDADES[0];
    pintar($('[data-festividades]', contenedor), html`
      <div class="tarjeta-cuerpo ajuste">
        <div class="ajuste-fila">
          <h3>Festividades de la página web</h3>
          <span class="fest-hoy">Hoy la web muestra: <b data-fest-hoy>${hoyF.emoji} ${hoyF.nombre}${festHoy?.variante ? ` · diseño ${festHoy.variante}` : ''}${festHoy?.numero ? ` · ${anios(festHoy.numero)}` : ''}</b>${festHoy?.automatico ? ' (automático)' : ''}</span>
        </div>
        <p>Elige una festividad y la web cambia al instante: colores, adornos, mensajes y el ícono de la pestaña. Cada festividad tiene 3 diseños.</p>
        <div class="festividades-grid">
          ${FESTIVIDADES.map((f) => html`
            <button type="button" class="festividad" data-fest="${f.id}" aria-pressed="${f.id === aj.tema}">
              <span class="festividad-emoji" aria-hidden="true">${f.emoji}</span><b>${f.nombre}</b><small>${f.ayuda}</small>
            </button>`)}
        </div>
        ${aj.tema !== 'normal' ? html`
          <div class="ajuste-fila fest-diseno">
            <span><b>Diseño</b> · en Automático cada año sale uno distinto</span>
            <div class="segmentado" role="group" aria-label="Diseño de la festividad">
              ${[null, 1, 2, 3].map((n) => html`<button type="button" data-variante="${n ?? 'auto'}" aria-pressed="${(aj.tema_variante ?? null) === n}">${n ? `Diseño ${n}` : 'Automático'}</button>`)}
            </div>
          </div>` : ''}
        <div class="aniversario-info">
          ${aniv ? html`
            <span>🎂 Aniversario: <b>${aniv.dia} de ${MESES_LARGOS[aniv.mes - 1]}</b>${prox ? html` · ${prox.enCurso ? 'celebrándose ahora' : `el próximo es el ${fechaCorta(prox.fecha)}`}: <b>${anios(prox.numero)}</b>` : ''}.
              Cada año la web se pone de aniversario sola durante ${DIAS_ANIVERSARIO} días.</span>
            <button type="button" class="btn btn--borde btn--sm" data-aniv-editar>Cambiar fecha</button>` : html`
            <span>🎂 Aún no has registrado el aniversario del negocio. Regístralo una vez y cada año la web lo celebra sola.</span>
            <button type="button" class="btn btn--sm" data-aniv-editar>Registrar aniversario</button>`}
        </div>
      </div>`);
  };

  const guardarFestividad = async (p, mensaje) => {
    try {
      const r = await ctx.api.guardarAjustes(p);
      aj = r;
      festHoy = r.festividad ?? festHoy;
      pintarFestividades();
      avisar(mensaje);
      return r;
    } catch (e) {
      avisar(mensajeError(e), 'error');
      return null;
    }
  };

  const formularioAniversario = (activar) => {
    const numeroActual = aj.aniversario_fundacion ? Number(hoyEn().slice(0, 4)) - aj.aniversario_fundacion : '';
    return modal({
      titulo: aj.aniversario_mes ? 'Cambiar fecha del aniversario' : 'Registrar aniversario',
      aceptar: activar ? 'Guardar y activar' : 'Guardar',
      contenido: html`
        <p>Se registra una sola vez. Desde entonces, cada año, ese día y los ${DIAS_ANIVERSARIO - 1} siguientes la web se pone de aniversario sola, con el número de años correcto.</p>
        <div class="fila-campos">
          <label class="campo"><span>Día</span><input name="dia" type="number" min="1" max="31" required value="${aj.aniversario_dia ?? ''}"></label>
          <label class="campo"><span>Mes</span><select name="mes">${MESES_LARGOS.map((m, i) => html`<option value="${i + 1}" ${aj.aniversario_mes === i + 1 ? 'selected' : ''}>${m}</option>`)}</select></label>
        </div>
        <label class="campo"><span>¿Qué número de aniversario cumplen ESTE año?</span>
          <input name="numero" type="number" min="1" max="200" required value="${numeroActual}">
          <small>Ejemplo: si abrieron en 2023 y este año cumplen 3 años, escribe 3.</small></label>`,
      alAbrir: (d) => d.querySelector('[name=dia]').focus(),
      alAceptar: async (f) => {
        const dia = Number(f.dia.value);
        const mes = Number(f.mes.value);
        const numero = Number(f.numero.value);
        if (!Number.isInteger(dia) || dia < 1 || dia > 31) throw new Error('Escribe un día entre 1 y 31');
        if (!Number.isInteger(numero) || numero < 1 || numero > 200) throw new Error('Escribe el número de aniversario (1 o más)');
        try {
          const r = await ctx.api.guardarAjustes({ aniversario: { dia, mes, numero }, ...(activar ? { tema: 'aniversario' } : {}) });
          aj = r;
          festHoy = r.festividad ?? festHoy;
        } catch (e) { throw Object.assign(e, { mensajeUsuario: mensajeError(e) }); }
        pintarFestividades();
        avisar(activar ? '🎂 ¡La web ya está de aniversario!' : 'Fecha del aniversario guardada');
        return true;
      },
    });
  };

  pintarFestividades();
  contenedor.addEventListener('click', async (e) => {
    const f = e.target.closest('[data-fest]');
    const v = e.target.closest('[data-variante]');
    const editar = e.target.closest('[data-aniv-editar]');
    if (f) {
      const id = f.dataset.fest;
      if (id === aj.tema) return;
      if (id === 'aniversario' && !aj.aniversario_mes) { await formularioAniversario(true); return; }
      const datos = FESTIVIDADES.find((x) => x.id === id);
      await guardarFestividad({ tema: id }, id === 'normal' ? 'La web volvió al diseño normal' : `${datos.emoji} La web ahora tiene el tema de ${datos.nombre}`);
    } else if (v) {
      const n = v.dataset.variante === 'auto' ? null : Number(v.dataset.variante);
      await guardarFestividad({ tema_variante: n }, n ? `Diseño ${n} aplicado en la web` : 'Diseño automático');
    } else if (editar) {
      await formularioAniversario(false);
    }
  });

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
    // La portada usa siempre la foto del plato elegido
    guardar({ producto_destacado_id: e.target.producto.value || null, titulo_destacado: e.target.titulo.value, foto_destacado_url: null }, 'Portada actualizada en la web');
  });
  $('[data-bebidas]', contenedor).addEventListener('submit', async (e) => {
    e.preventDefault();
    const lista = (t) => t.split('\n').map((x) => x.trim()).filter(Boolean);
    try {
      await ctx.api.guardarBebidas({ gaseosas: lista(e.target.gaseosas.value), bebidas_michelada: lista(e.target.micheladas.value) });
      avisar('Bebidas actualizadas en la web');
    } catch (err) {
      avisar(mensajeError(err), 'error');
    }
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
    disponible: `Hay una versión nueva (${e.nueva}): toca "Descargar" arriba y abre el archivo para instalarla.`,
    error: `No se pudo buscar: ${e.mensaje ?? 'sin conexión'}`,
  }[e.estado] ?? '';
}
