/**
 * Administración del menú: lo que se guarde aquí aparece en la web al instante.
 */
import { html, icono, pintar, avisar, modal, confirmar, $ } from '../ui.js';
import { formatearCOP, parsearCOP } from '../../../shared/dinero.js';
import { mensajeError } from '../../../shared/utilidades.js';
import { urlFoto, optimizarFoto } from '../datos.js';

export async function montar(contenedor, ctx) {
  let menu = await ctx.api.menu();
  let categoriaSel = menu.categorias[0]?.id ?? null;
  let busqueda = '';
  const urlSitio = () => menu.ajustes?.url_sitio ?? '';

  const recargar = async () => { menu = await ctx.api.menu(); pintarTodo(); };

  function pintarTodo() {
    const cat = menu.categorias.find((c) => c.id === categoriaSel);
    const q = busqueda.toLowerCase();
    const productos = menu.productos.filter((p) => (q ? p.nombre.toLowerCase().includes(q) : p.categoria_id === categoriaSel));
    pintar(contenedor, html`
      <div class="menu-admin">
        <section class="tarjeta" aria-label="Categorías">
          <div class="tarjeta-cabeza"><h2>Categorías</h2><button class="btn btn--sm" data-nueva-cat>${icono('mas')} Nueva</button></div>
          <div class="tarjeta-cuerpo lista-categorias">
            ${menu.categorias.map((c) => html`
              <button class="cat-item ${c.activa ? '' : 'oculta'}" data-cat="${c.id}" aria-pressed="${!busqueda && c.id === categoriaSel}">
                <b>${c.nombre}</b><small>${c.num_productos}</small>
              </button>`)}
          </div>
        </section>
        <section class="tarjeta" aria-label="Productos">
          <div class="tarjeta-cabeza">
            <h2>${busqueda ? 'Resultados' : cat?.nombre ?? 'Productos'}</h2>
            <div style="display:flex;gap:8px;align-items:center">
              <label class="buscador" style="min-height:36px">${icono('buscar')}<span class="visualmente-oculto">Buscar</span><input data-buscar placeholder="Buscar en todo el menú" value="${busqueda}"></label>
              ${cat && !busqueda ? html`<button class="btn btn--borde btn--sm" data-editar-cat="${cat.id}">${icono('editar')} Categoría</button>` : ''}
              <button class="btn btn--primario btn--sm" data-nuevo>${icono('mas')} Nuevo plato</button>
            </div>
          </div>
          <div class="tarjeta-cuerpo">
            ${productos.length ? html`
              <table class="tabla">
                <thead><tr><th></th><th>Plato</th><th class="der">Precio</th><th>En la web</th><th>Agotado</th><th></th></tr></thead>
                <tbody>
                  ${productos.map((p) => html`
                    <tr class="${p.activo ? '' : 'inactivo'}" data-fila="${p.id}">
                      <td><img class="miniatura" src="${urlFoto(p.foto_url, urlSitio(), 120)}" loading="lazy" alt="" data-foto></td>
                      <td class="producto-nombre"><b>${p.nombre}</b> ${p.etiqueta ? html`<span class="chip chip--rojo">${p.etiqueta}</span>` : ''}<small>${p.descripcion}</small></td>
                      <td class="der num"><b>${formatearCOP(p.precio)}</b></td>
                      <td><label class="interruptor"><input type="checkbox" data-alternar="activo" data-id="${p.id}" ${p.activo ? 'checked' : ''} aria-label="Mostrar ${p.nombre} en la web"></label></td>
                      <td><label class="interruptor"><input type="checkbox" data-alternar="agotado" data-id="${p.id}" ${p.agotado ? 'checked' : ''} aria-label="Marcar ${p.nombre} como agotado"></label></td>
                      <td><div class="acciones-fila">
                        <button class="btn-icono" data-editar="${p.id}" aria-label="Editar ${p.nombre}">${icono('editar')}</button>
                        <button class="btn-icono btn-icono--peligro" data-borrar="${p.id}" aria-label="Eliminar ${p.nombre}">${icono('borrar')}</button>
                      </div></td>
                    </tr>`)}
                </tbody>
              </table>` : html`<div class="vacio"><img src="img/logo.webp" alt=""><p>${busqueda ? 'Ningún plato coincide.' : 'Esta categoría aún no tiene platos.'}</p></div>`}
          </div>
        </section>
      </div>`);
    const b = $('[data-buscar]', contenedor);
    if (busqueda) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); }
  }

  // ---------- Formularios ----------
  function formularioProducto(p = null) {
    let fotoNueva = null; // Blob optimizado pendiente de subir
    return modal({
      titulo: p ? `Editar ${p.nombre}` : 'Nuevo plato',
      contenido: html`
        <div class="foto-editor">
          ${p?.foto_url ? html`<img src="${urlFoto(p.foto_url, urlSitio())}" alt="" data-vista-foto>` : html`<div class="foto-vacia" data-vista-foto>${icono('foto')}</div>`}
          <div class="campo"><span>Foto</span><input type="file" accept="image/jpeg,image/png,image/webp" data-archivo>
            <small>Se optimiza sola a WebP (máx. 900 px) para que la web cargue rápido.</small></div>
        </div>
        <label class="campo"><span>Nombre</span><input name="nombre" maxlength="60" required value="${p?.nombre ?? ''}"></label>
        <label class="campo"><span>Descripción</span><textarea name="descripcion" maxlength="240" rows="2">${p?.descripcion ?? ''}</textarea></label>
        <div class="fila-campos">
          <label class="campo"><span>Precio</span><input name="precio" inputmode="numeric" required value="${p ? p.precio : ''}" placeholder="Ej: 25.000"></label>
          <label class="campo"><span>Categoría</span><select name="categoria">
            ${menu.categorias.map((c) => html`<option value="${c.id}" ${c.id === (p?.categoria_id ?? categoriaSel) ? 'selected' : ''}>${c.nombre}</option>`)}
          </select></label>
        </div>
        <div class="fila-campos">
          <label class="campo"><span>Etiqueta <em>(opcional)</em></span><input name="etiqueta" maxlength="24" value="${p?.etiqueta ?? ''}" placeholder="Ej: Nueva, Picante"></label>
          <label class="campo"><span>Orden</span><input name="orden" type="number" min="0" max="999" value="${p?.orden ?? 0}"></label>
        </div>
        <label class="interruptor"><input type="checkbox" name="activo" ${p?.activo ?? true ? 'checked' : ''}> Mostrar en la web</label>`,
      alAbrir: (d) => {
        $('[data-archivo]', d).addEventListener('change', async (e) => {
          const archivo = e.target.files[0];
          if (!archivo) return;
          try {
            fotoNueva = await optimizarFoto(archivo);
            const vista = $('[data-vista-foto]', d);
            const img = document.createElement('img');
            img.src = URL.createObjectURL(fotoNueva);
            img.dataset.vistaFoto = '';
            vista.replaceWith(img);
          } catch (err) {
            avisar(err.message, 'error');
            e.target.value = '';
          }
        });
        d.querySelector('[name=nombre]').focus();
      },
      alAceptar: async (f) => {
        const precio = parsearCOP(f.precio.value);
        if (precio === null) throw new Error('Escribe el precio en pesos, sin decimales (ej. 25.000)');
        let foto = p?.foto_url ?? null;
        if (fotoNueva) foto = await ctx.api.fuente.subirFoto(fotoNueva);
        try {
          await ctx.api.guardarProducto({
            ...(p ? { id: p.id } : {}),
            categoria_id: f.categoria.value, nombre: f.nombre.value, descripcion: f.descripcion.value,
            precio, etiqueta: f.etiqueta.value, foto_url: foto, orden: Number(f.orden.value) || 0,
            activo: f.activo.checked, agotado: p?.agotado ?? false,
          });
        } catch (e) { throw Object.assign(e, { mensajeUsuario: mensajeError(e) }); }
        categoriaSel = f.categoria.value;
        avisar(html`<b>${f.nombre.value}</b> guardado. Ya se ve en la web.`);
        await recargar();
        return true;
      },
    });
  }

  function formularioCategoria(c = null) {
    return modal({
      titulo: c ? 'Editar categoría' : 'Nueva categoría',
      contenido: html`
        <label class="campo"><span>Nombre</span><input name="nombre" maxlength="40" required value="${c?.nombre ?? ''}"></label>
        <label class="campo"><span>Orden en el menú</span><input name="orden" type="number" min="0" max="999" value="${c?.orden ?? menu.categorias.length + 1}"></label>
        <label class="interruptor"><input type="checkbox" name="activa" ${c?.activa ?? true ? 'checked' : ''}> Mostrar en la web</label>
        ${c ? html`<button type="button" class="btn btn--borde btn--sm" data-borrar-cat style="justify-self:start">${icono('borrar')} Eliminar categoría</button>` : ''}`,
      alAbrir: (d) => {
        d.querySelector('[name=nombre]').focus();
        $('[data-borrar-cat]', d)?.addEventListener('click', async () => {
          try {
            await ctx.api.eliminarCategoria(c.id);
            d.close();
            categoriaSel = menu.categorias.find((x) => x.id !== c.id)?.id ?? null;
            avisar('Categoría eliminada');
            await recargar();
          } catch (e) { avisar(mensajeError(e), 'error'); }
        });
      },
      alAceptar: async (f) => {
        try {
          const r = await ctx.api.guardarCategoria({ ...(c ? { id: c.id } : {}), nombre: f.nombre.value, orden: Number(f.orden.value) || 0, activa: f.activa.checked });
          categoriaSel = r.id;
        } catch (e) { throw Object.assign(e, { mensajeUsuario: mensajeError(e) }); }
        await recargar();
        return true;
      },
    });
  }

  // ---------- Eventos ----------
  contenedor.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-cat],[data-nuevo],[data-editar],[data-borrar],[data-nueva-cat],[data-editar-cat]');
    if (!t) return;
    const prod = (id) => menu.productos.find((p) => p.id === id);
    try {
      if (t.dataset.cat) { categoriaSel = t.dataset.cat; busqueda = ''; pintarTodo(); }
      else if (t.hasAttribute('data-nuevo')) await formularioProducto();
      else if (t.dataset.editar) await formularioProducto(prod(t.dataset.editar));
      else if (t.hasAttribute('data-nueva-cat')) await formularioCategoria();
      else if (t.dataset.editarCat) await formularioCategoria(menu.categorias.find((c) => c.id === t.dataset.editarCat));
      else if (t.dataset.borrar) {
        const p = prod(t.dataset.borrar);
        if (p.tiene_ventas) {
          avisar('Este plato tiene ventas registradas: desactiva "En la web" para ocultarlo.', 'error', 5000);
          return;
        }
        if (await confirmar('Eliminar plato', `¿Eliminar "${p.nombre}" del menú? Esta acción no se puede deshacer.`, { aceptar: 'Eliminar', peligro: true })) {
          await ctx.api.eliminarProducto(p.id);
          avisar(html`<b>${p.nombre}</b> eliminado`);
          await recargar();
        }
      }
    } catch (err) {
      avisar(mensajeError(err), 'error');
    }
  });

  contenedor.addEventListener('change', async (e) => {
    const t = e.target.closest('[data-alternar]');
    if (!t) return;
    const p = menu.productos.find((x) => x.id === t.dataset.id);
    t.disabled = true;
    try {
      await ctx.api.guardarProducto({ ...p, [t.dataset.alternar]: t.checked });
      avisar(html`<b>${p.nombre}</b>: ${t.dataset.alternar === 'activo' ? (t.checked ? 'visible en la web' : 'oculto en la web') : (t.checked ? 'marcado como agotado' : 'disponible otra vez')}`);
      await recargar();
    } catch (err) {
      t.checked = !t.checked;
      t.disabled = false;
      avisar(mensajeError(err), 'error');
    }
  });

  contenedor.addEventListener('input', (e) => {
    if (e.target.matches('[data-buscar]')) { busqueda = e.target.value; pintarTodo(); }
  });
  contenedor.addEventListener('error', (e) => { if (e.target.matches?.('[data-foto]')) e.target.src = 'img/logo.webp'; }, true);

  pintarTodo();
}
