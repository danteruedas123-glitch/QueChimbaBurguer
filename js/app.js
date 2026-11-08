/* =====================================================================
   QUECHIMBA BURGER — Lógica del sitio
   Lee los datos de js/config.js. No es necesario editar este archivo
   para cambiar precios, productos u horarios.
   ===================================================================== */
(() => {
  'use strict';

  const CFG = window.QB_CONFIG;
  if (!CFG) return;

  const { negocio, horario } = CFG;
  const KEY_CARRITO = 'qb_carrito_v1';
  const KEY_CLIENTE = 'qb_cliente_v1';
  const KEY_MENU = 'qb_menu_v1';

  /* ---------- Menú: viene de Supabase (si está configurado) o de config.js ---------- */
  // Formato interno: producto { id (slug), categoria (slug), nombre, descripcion, precio, etiqueta, foto, agotado }
  let categorias = CFG.categorias;
  let productos = CFG.productos.map((p) => ({ ...p, agotado: !!p.agotado, opciones: p.opciones ?? [] }));
  let destacado = CFG.promo ?? null;
  let bebidas = CFG.bebidas ?? { gaseosas: [], bebidas_michelada: [] };
  let pedidosWebActivos = true;
  let festividad = CFG.festividad ?? { tema: CFG.tema ?? 'normal' };
  let productoPorId = new Map(productos.map((p) => [p.id, p]));

  const SB = CFG.supabase ?? {};
  const conSupabase = Boolean(SB.url && SB.anonKey);

  // Llama una función de la base de datos (PostgREST) con tiempo límite
  async function rpc(funcion, cuerpo, ms = 6000) {
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), ms);
    const cabeceras = { apikey: SB.anonKey, 'Content-Type': 'application/json' };
    if (SB.anonKey.split('.').length === 3) cabeceras.Authorization = `Bearer ${SB.anonKey}`;
    try {
      const r = await fetch(`${SB.url.replace(/\/$/, '')}/rest/v1/rpc/${funcion}`, {
        method: 'POST', headers: cabeceras, body: JSON.stringify(cuerpo ?? {}), signal: control.signal
      });
      const datos = await r.json().catch(() => null);
      if (!r.ok) throw Object.assign(new Error(datos?.message ?? `Error ${r.status}`), { hint: datos?.hint ?? null });
      return datos;
    } finally {
      clearTimeout(reloj);
    }
  }

  // Convierte el menú de la base de datos al formato del sitio
  const desdeServidor = (m) => ({
    categorias: m.categorias.map((c) => ({ id: c.slug, nombre: c.nombre })),
    productos: m.productos.map((p) => ({
      id: p.slug, categoria: p.categoria, nombre: p.nombre, descripcion: p.descripcion,
      precio: p.precio, etiqueta: p.etiqueta || undefined, foto: p.foto_url || 'assets/img/logo.webp', agotado: !!p.agotado,
      opciones: p.opciones ?? []
    })),
    destacado: m.destacado ? { producto: m.destacado.producto, titulo: m.destacado.titulo, foto: m.destacado.foto_url } : null,
    bebidas: m.bebidas ?? null,
    pedidosWebActivos: m.pedidos_web_activos !== false,
    festividad: m.festividad ?? { tema: 'normal' }
  });

  const usarMenu = (m) => {
    categorias = m.categorias;
    productos = m.productos;
    destacado = m.destacado;
    if (m.bebidas) bebidas = m.bebidas;
    pedidosWebActivos = m.pedidosWebActivos;
    festividad = m.festividad ?? { tema: 'normal' };
    productoPorId = new Map(productos.map((p) => [p.id, p]));
  };

  /* ---------- Utilidades ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const precio = (n) => '$' + Math.round(n).toLocaleString('es-CO');
  const escapar = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const icono = (id) => `<svg aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const linkWhatsApp = (texto) => `https://wa.me/${negocio.whatsapp}?text=${encodeURIComponent(texto)}`;

  // Pide a Unsplash el tamaño justo; las fotos locales se usan tal cual.
  const esUnsplash = (url) => url.includes('images.unsplash.com');
  const foto = (url, ancho, alto) => {
    if (!esUnsplash(url)) return url;
    return `${url}?auto=format&fit=crop&w=${ancho}${alto ? `&h=${alto}` : ''}&q=72`;
  };

  /* ---------- Opciones al pedir (bebida del combo, en agua o en leche, nivel…) ---------- */
  // Cada grupo: { titulo, elige, opciones: [{ nombre, extra }] } o { titulo, elige, lista } (bebidas de Ajustes)
  const opcionesDe = (g) => (g.lista ? (bebidas[g.lista] ?? []).map((nombre) => ({ nombre, extra: 0 })) : g.opciones);
  const tieneOpciones = (p) => (p?.opciones?.length ?? 0) > 0;
  const tieneExtras = (p) => (p?.opciones ?? []).some((g) => !g.lista && g.opciones.some((o) => o.extra > 0));
  // Línea del carrito: "slug", o "slug~[[...],[...]]" cuando lleva opciones elegidas
  const claveLinea = (id, elegidas) => (elegidas ? `${id}~${JSON.stringify(elegidas)}` : id);
  const leerLinea = (clave) => {
    const i = clave.indexOf('~');
    if (i < 0) return { id: clave, elegidas: null };
    try { return { id: clave.slice(0, i), elegidas: JSON.parse(clave.slice(i + 1)) }; } catch { return { id: clave.slice(0, i), elegidas: [] }; }
  };
  // ¿Lo elegido sigue valiendo? (el dueño pudo cambiar las opciones o las bebidas)
  const eleccionValida = (p, elegidas) => {
    if (!tieneOpciones(p)) return elegidas === null;
    return Array.isArray(elegidas) && elegidas.length === p.opciones.length && p.opciones.every((g, i) =>
      Array.isArray(elegidas[i]) && elegidas[i].length === g.elige && elegidas[i].every((n) => opcionesDe(g).some((o) => o.nombre === n)));
  };
  const extraDe = (p, elegidas) => (elegidas ?? []).reduce((s, sel, i) =>
    s + sel.reduce((t, n) => t + (opcionesDe(p.opciones[i]).find((o) => o.nombre === n)?.extra ?? 0), 0), 0);
  const detalleDe = (p, elegidas) => (elegidas ?? []).map((sel, i) => `${p.opciones[i].titulo}: ${sel.join(', ')}`).join(' · ');
  const precioLinea = (clave) => { const { id, elegidas } = leerLinea(clave); const p = productoPorId.get(id); return p.precio + extraDe(p, elegidas); };

  const almacen = {
    leer(clave, defecto) {
      try { return JSON.parse(localStorage.getItem(clave)) ?? defecto; } catch { return defecto; }
    },
    guardar(clave, valor) {
      try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* modo privado */ }
    }
  };

  /* ---------- Datos del negocio en la página ---------- */
  const enlaces = {
    whatsapp: linkWhatsApp(negocio.mensajeWhatsApp),
    tel: `tel:+${negocio.whatsapp}`,
    correo: negocio.correo && `mailto:${negocio.correo}`,
    instagram: negocio.instagram,
    facebook: negocio.facebook,
    mapa: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(negocio.mapaBusqueda)}`
  };
  $$('[data-link]').forEach((a) => {
    const url = enlaces[a.dataset.link];
    if (url) a.href = url; else a.hidden = true;
  });
  $$('[data-dato]').forEach((el) => { el.textContent = negocio[el.dataset.dato] ?? ''; });
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
  const pintarPreciosSueltos = () => $$('[data-precio-de]').forEach((el) => {
    const p = productoPorId.get(el.dataset.precioDe);
    el.hidden = !p;
    if (p) el.textContent = precio(p.precio);
  });
  // El mapa (~1 MB) solo se descarga cuando el cliente toca "Ver mapa"
  const mapa = $('[data-mapa]');
  mapa?.addEventListener('click', () => {
    const iframe = document.createElement('iframe');
    iframe.title = `Mapa de ubicación de ${negocio.nombre}`;
    iframe.referrerPolicy = 'no-referrer-when-downgrade';
    iframe.src = `https://www.google.com/maps?q=${encodeURIComponent(negocio.mapaBusqueda)}&output=embed`;
    mapa.replaceWith(iframe);
  }, { once: true });

  /* ---------- Horario y estado "abierto / cerrado" ---------- */
  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const aMinutos = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  const hora12 = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    const sufijo = h % 24 >= 12 ? 'p. m.' : 'a. m.';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${sufijo}`;
  };
  const turnoDe = (dia) => horario.find((t) => t.dia === dia);
  const cruzaMedianoche = (t) => aMinutos(t.cierra) <= aMinutos(t.abre);

  // Hora actual en Colombia, sin importar la zona horaria del celular del cliente.
  const ahora = () => {
    const partes = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', { timeZone: negocio.zonaHoraria, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
        .formatToParts(new Date()).map((p) => [p.type, p.value])
    );
    return { dia: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(partes.weekday), min: (Number(partes.hour) % 24) * 60 + Number(partes.minute) };
  };

  const estadoActual = () => {
    const { dia, min } = ahora();
    const ayer = turnoDe((dia + 6) % 7);
    if (ayer && cruzaMedianoche(ayer) && min < aMinutos(ayer.cierra)) {
      return { abierto: true, texto: `Abierto ahora · cierra a las ${hora12(ayer.cierra)}` };
    }
    const hoy = turnoDe(dia);
    if (hoy) {
      const abre = aMinutos(hoy.abre);
      const cierra = aMinutos(hoy.cierra);
      const dentro = cruzaMedianoche(hoy) ? min >= abre : min >= abre && min < cierra;
      if (dentro) return { abierto: true, texto: `Abierto ahora · cierra a las ${hora12(hoy.cierra)}` };
      if (min < abre) return { abierto: false, texto: `Cerrado · abrimos hoy a las ${hora12(hoy.abre)}` };
    }
    for (let i = 1; i <= 7; i++) {
      const d = (dia + i) % 7;
      const t = turnoDe(d);
      if (t) {
        const cuando = i === 1 ? 'mañana' : `el ${DIAS[d].toLowerCase()}`;
        return { abierto: false, texto: `Cerrado · abrimos ${cuando} a las ${hora12(t.abre)}` };
      }
    }
    return { abierto: false, texto: 'Cerrado temporalmente' };
  };

  const pintarEstado = () => {
    const e = estadoActual();
    $$('[data-estado]').forEach((el) => {
      el.textContent = e.texto;
      el.classList.toggle('is-open', e.abierto);
      el.classList.toggle('is-closed', !e.abierto);
    });
  };

  const pintarHorario = () => {
    const lista = $('[data-horario]');
    if (!lista) return;
    const hoy = ahora().dia;
    const corto = (d) => DIAS[d].slice(0, 3);
    // Agrupa días seguidos con el mismo horario: "Lun – Jue  5:00 p. m. – 11:00 p. m."
    const grupos = [];
    [1, 2, 3, 4, 5, 6, 0].forEach((d) => {
      const t = turnoDe(d);
      const horas = t ? `${hora12(t.abre)} – ${hora12(t.cierra)}` : 'Cerrado';
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.horas === horas) ultimo.dias.push(d);
      else grupos.push({ horas, dias: [d] });
    });
    lista.innerHTML = grupos.map(({ horas, dias }) => {
      const nombre = dias.length === 1 ? DIAS[dias[0]] : `${corto(dias[0])} – ${corto(dias[dias.length - 1])}`;
      const esHoy = dias.includes(hoy);
      return `<li class="${esHoy ? 'is-today' : ''}"><span>${nombre}</span><span>${horas}</span></li>`;
    }).join('');
  };

  pintarEstado();
  pintarHorario();
  setInterval(pintarEstado, 60_000);

  /* ---------- Menú (acordeón por categorías) ---------- */
  const menu = $('[data-menu]');
  const buscador = $('[data-search]');
  const contador = $('[data-menu-count]');
  const vacio = $('[data-menu-empty]');

  const tarjeta = (p) => `
    <article class="dish ${p.agotado ? 'is-soldout' : ''}" data-id="${escapar(p.id)}" data-texto="${escapar(normalizar(`${p.nombre} ${p.descripcion} ${p.etiqueta ?? ''}`))}">
      <div class="dish-media">
        <img src="${escapar(foto(p.foto, 600, 450))}"
             ${esUnsplash(p.foto) ? `srcset="${escapar(foto(p.foto, 360, 270))} 360w, ${escapar(foto(p.foto, 600, 450))} 600w, ${escapar(foto(p.foto, 900, 675))} 900w"
             sizes="(max-width: 760px) 40vw, (max-width: 1200px) 33vw, 380px"` : ''}
             width="600" height="450" loading="lazy" decoding="async" alt="${escapar(p.nombre)}">
        ${p.etiqueta ? `<span class="dish-tag">${escapar(p.etiqueta)}</span>` : ''}
      </div>
      <div class="dish-body">
        <h3 class="dish-name">${escapar(p.nombre)}</h3>
        <p class="dish-desc">${escapar(p.descripcion)}</p>
        <div class="dish-foot">
          <span class="dish-price">${tieneExtras(p) ? '<small>desde </small>' : ''}${precio(p.precio)}</span>
          <div class="dish-action" data-action-for="${escapar(p.id)}"></div>
        </div>
      </div>
    </article>`;

  // Las fotos de cada categoría solo se descargan al abrirla (ahorra datos)
  let grupos = [];
  let buscando = false;
  let abiertaAntes = null;
  const pintarMenu = () => {
    if (!menu) return;
    const abierta = grupos.find((g) => g.open)?.dataset.grupo;
    menu.innerHTML = categorias.map((c) => {
      const items = productos.filter((p) => p.categoria === c.id);
      if (!items.length) return '';
      const desde = Math.min(...items.map((p) => p.precio));
      const portada = items.find((p) => p.etiqueta) ?? items[0];
      return `
        <details class="cat" name="menu-cat" data-grupo="${escapar(c.id)}">
          <summary class="cat-head">
            <img class="cat-thumb" src="${escapar(foto(portada.foto, 144, 144))}" width="72" height="72" alt="" decoding="async">
            <span class="cat-info">
              <span class="cat-name">${escapar(c.nombre)}</span>
              <span class="cat-meta">${items.length} ${items.length === 1 ? 'opción' : 'opciones'} · desde ${precio(desde)}</span>
            </span>
            <span class="cat-badge" data-cat-badge="${escapar(c.id)}" hidden></span>
            <svg class="cat-chev" aria-hidden="true"><use href="#i-chevron"/></svg>
          </summary>
          <div class="cat-body"><div class="menu-grid">${items.map(tarjeta).join('')}</div></div>
        </details>`;
    }).join('');
    grupos = $$('.cat', menu);
    // Al abrir una categoría, llevarla arriba para que se vean sus productos
    grupos.forEach((g) => g.addEventListener('toggle', () => {
      if (!g.open || buscando) return;
      requestAnimationFrame(() => {
        const top = g.getBoundingClientRect().top;
        const header = $('[data-header]').offsetHeight;
        if (top < header || top > window.innerHeight * 0.45) g.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }));
    const previa = grupos.find((g) => g.dataset.grupo === abierta);
    if (previa) previa.open = true;
    if (buscador?.value) aplicarBusqueda();
  };

  const aplicarBusqueda = () => {
    const q = normalizar(buscador?.value);
    if (q && !buscando) {
      // Al buscar se abren todas las categorías con resultados
      buscando = true;
      abiertaAntes = grupos.find((g) => g.open)?.dataset.grupo ?? null;
      grupos.forEach((g) => g.removeAttribute('name'));
    }
    let total = 0;
    grupos.forEach((g) => {
      let visibles = 0;
      $$('.dish', g).forEach((d) => {
        const ok = !q || d.dataset.texto.includes(q);
        d.hidden = !ok;
        if (ok) visibles++;
      });
      g.hidden = visibles === 0;
      if (q) g.open = visibles > 0;
      total += visibles;
    });
    if (!q && buscando) {
      buscando = false;
      grupos.forEach((g) => { g.open = g.dataset.grupo === abiertaAntes; g.setAttribute('name', 'menu-cat'); });
    }
    contador.textContent = q ? `${total} ${total === 1 ? 'resultado' : 'resultados'}` : '';
    vacio.hidden = total > 0;
  };
  buscador?.addEventListener('input', aplicarBusqueda);

  const abrirCategoria = (id) => {
    if (buscador?.value) { buscador.value = ''; aplicarBusqueda(); }
    const g = grupos.find((x) => x.dataset.grupo === id);
    if (!g) return;
    g.open = true;
    g.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  // Enlaces que abren una categoría (ej. "Ver todos los combos")
  $$('[data-abrir-cat]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    abrirCategoria(a.dataset.abrirCat);
  }));

  /* ---------- Portada: el producto destacado (se elige en la app → Ajustes) ---------- */
  const heroImg = $('[data-hero-img]');
  const HERO_ORIGINAL = { src: heroImg?.getAttribute('src'), alt: heroImg?.alt };
  const pintarPortada = () => {
    const ticket = $('[data-hero-ticket]');
    if (!ticket || !heroImg) return;
    const p = destacado && productoPorId.get(destacado.producto);
    ticket.hidden = !p;
    const src = p ? (destacado.foto || foto(p.foto, 720, 720)) : HERO_ORIGINAL.src;
    if (heroImg.getAttribute('src') !== src) heroImg.src = src;
    heroImg.alt = p ? p.nombre : HERO_ORIGINAL.alt;
    if (!p) return;
    $('[data-hero-titulo]').textContent = destacado.titulo || 'Recomendado';
    $('[data-hero-nombre]').textContent = p.nombre;
    $('[data-hero-precio]').textContent = `${tieneExtras(p) ? 'desde ' : ''}${precio(p.precio)}`;
    ticket.dataset.producto = p.id;
    ticket.setAttribute('aria-label', `Pedir ${p.nombre}, ${precio(p.precio)}`);
  };
  $('[data-hero-ticket]')?.addEventListener('click', (e) => {
    const id = e.currentTarget.dataset.producto;
    const p = productoPorId.get(id);
    if (!p || !pedidosWebActivos || p.agotado) { abrirCategoria(p?.categoria); return; }
    if (tieneOpciones(p)) abrirOpciones(id); else cambiarCantidad(id, 1);
  });

  /* ---------- Carrito ---------- */
  const carrito = new Map(
    Object.entries(almacen.leer(KEY_CARRITO, {})).filter(([, n]) => Number.isInteger(n) && n > 0)
  );
  // Quita del carrito lo que ya no existe o se agotó (ej. el encargado lo cambió en la app)
  const depurarCarrito = () => {
    const quitados = [];
    carrito.forEach((n, clave) => {
      const { id, elegidas } = leerLinea(clave);
      const p = productoPorId.get(id);
      if (!p || p.agotado || !eleccionValida(p, elegidas)) { carrito.delete(clave); if (p) quitados.push(p.nombre); }
    });
    guardarCarrito();
    return quitados;
  };
  const unidadesDe = (id) => [...carrito].reduce((s, [clave, n]) => s + (leerLinea(clave).id === id ? n : 0), 0);

  const totales = () => {
    let unidades = 0;
    let subtotal = 0;
    carrito.forEach((n, clave) => { unidades += n; subtotal += n * precioLinea(clave); });
    return { unidades, subtotal };
  };

  const controlCantidad = (clave, nombre, n) => `
    <div class="stepper" role="group" aria-label="Cantidad de ${escapar(nombre)}">
      <button type="button" data-dec="${escapar(clave)}" aria-label="Quitar una ${escapar(nombre)}">${icono('minus')}</button>
      <output aria-live="polite">${n}</output>
      <button type="button" data-inc="${escapar(clave)}" aria-label="Agregar otra ${escapar(nombre)}">${icono('plus')}</button>
    </div>`;

  const pintarAccion = (id) => {
    const p = productoPorId.get(id);
    if (!p) return;
    const n = unidadesDe(id);
    $$(`[data-action-for="${CSS.escape(id)}"]`).forEach((caja) => {
      caja.innerHTML = p.agotado
        ? '<span class="soldout">Agotado</span>'
        : tieneOpciones(p)
          // Con opciones: cada vez se elige (ej. otra bebida); el número dice cuántos lleva
          ? `<button class="add-btn" type="button" data-elegir="${escapar(id)}" aria-label="${n ? 'Agregar otro' : 'Agregar'} ${escapar(p.nombre)} al pedido">${icono('plus')}<span>${n ? 'Otro' : 'Agregar'}</span>${n ? `<b class="add-count">${n}</b>` : ''}</button>`
          : n
            ? controlCantidad(id, p.nombre, n)
            : `<button class="add-btn" type="button" data-inc="${escapar(id)}" aria-label="Agregar ${escapar(p.nombre)} al pedido">${icono('plus')}<span>Agregar</span></button>`;
      caja.closest('.dish')?.classList.toggle('in-cart', n > 0);
    });
  };

  const lineas = $('[data-cart-lines]');
  const pintarCarrito = () => {
    const { unidades, subtotal } = totales();
    const hay = unidades > 0;

    $$('[data-cart-count]').forEach((el) => { el.textContent = unidades; });
    // Número de productos pedidos en cada categoría del menú
    $$('[data-cat-badge]').forEach((el) => {
      let n = 0;
      carrito.forEach((q, clave) => { if (productoPorId.get(leerLinea(clave).id).categoria === el.dataset.catBadge) n += q; });
      el.textContent = n;
      el.hidden = n === 0;
      el.setAttribute('aria-label', `${n} en tu pedido`);
    });
    $$('.cart-btn [data-cart-count]').forEach((el) => { el.hidden = !hay; });
    $$('[data-cart-total]').forEach((el) => { el.textContent = precio(subtotal); });
    $('[data-cart-bar]').hidden = !hay;
    document.body.classList.toggle('has-cart', hay);
    $('.cart-btn').setAttribute('aria-label', hay ? `Ver mi pedido: ${unidades} ${unidades === 1 ? 'producto' : 'productos'}` : 'Ver mi pedido');

    $('[data-cart-empty]').hidden = hay;
    $('[data-cart-filled]').hidden = !hay;
    $('[data-cart-foot]').hidden = !hay;

    lineas.innerHTML = [...carrito].map(([clave, n]) => {
      const { id, elegidas } = leerLinea(clave);
      const p = productoPorId.get(id);
      const unitario = precioLinea(clave);
      const detalle = detalleDe(p, elegidas);
      return `
        <li class="line">
          <img src="${escapar(foto(p.foto, 120, 120))}" width="60" height="60" alt="">
          <div class="line-info"><strong>${escapar(p.nombre)}</strong>${detalle ? `<small class="line-det">${escapar(detalle)}</small>` : ''}<span>${precio(unitario)} c/u</span></div>
          <span class="line-total">${precio(unitario * n)}</span>
          ${controlCantidad(clave, p.nombre, n)}
        </li>`;
    }).join('');
  };

  const guardarCarrito = () => almacen.guardar(KEY_CARRITO, Object.fromEntries(carrito));

  const botonCarrito = $('.cart-btn');
  const cambiarCantidad = (clave, delta) => {
    const { id } = leerLinea(clave);
    const p = productoPorId.get(id);
    if (!p || (p.agotado && delta > 0)) return;
    const antes = carrito.get(clave) ?? 0;
    const n = Math.max(0, Math.min(99, antes + delta));
    if (n) carrito.set(clave, n); else carrito.delete(clave);
    guardarCarrito();
    pintarAccion(id);
    pintarCarrito();
    if (delta > 0) {
      avisar(`<b>+1</b> ${escapar(p.nombre)}`);
      botonCarrito.classList.remove('bump');
      void botonCarrito.offsetWidth; // reinicia la animación
      botonCarrito.classList.add('bump');
    }
  };

  // Un solo listener para todos los botones + / − del sitio
  document.addEventListener('click', (e) => {
    const elegir = e.target.closest('[data-elegir]');
    if (elegir) { abrirOpciones(elegir.dataset.elegir); return; }
    const b = e.target.closest('[data-inc], [data-dec]');
    if (!b) return;
    const sube = b.hasAttribute('data-inc');
    const id = sube ? b.dataset.inc : b.dataset.dec;
    const zona = b.closest('[data-action-for], [data-cart-lines]');
    cambiarCantidad(id, sube ? 1 : -1);
    // Mantener el foco del teclado en el control equivalente tras redibujar
    if (zona && !zona.contains(document.activeElement)) {
      const mismo = zona.querySelector(`[data-${sube ? 'inc' : 'dec'}="${CSS.escape(id)}"]`);
      (mismo ?? zona.querySelector('button') ?? $('[data-close-cart]'))?.focus();
    }
  });

  $('[data-clear-cart]')?.addEventListener('click', () => {
    const ids = [...new Set([...carrito.keys()].map((c) => leerLinea(c).id))];
    carrito.clear();
    guardarCarrito();
    ids.forEach(pintarAccion);
    pintarCarrito();
    $('[data-close-cart]').focus();
    avisar('Pedido vaciado');
  });

  /** Web desactivada por el dueño: aviso de cerrado y sin ninguna forma de pedir (ni página ni WhatsApp). */
  const pintarAvisoPausa = () => {
    const cerrada = !pedidosWebActivos;
    document.body.classList.toggle('web-cerrada', cerrada);
    const banner = $('[data-aviso-cerrado]');
    if (banner) banner.hidden = !cerrada;
    const aviso = $('[data-pausa]');
    if (aviso) aviso.hidden = !cerrada;
    const enviar = $('[data-enviar]');
    if (enviar) enviar.disabled = cerrada;
    if (cerrada && panel?.open) cerrarPanel();
  };

  /** Dibuja todo lo que depende del menú (al iniciar y cada vez que el menú cambie). */
  /* ---------- Festividades: tema de temporada (elegido en la app) ---------- */
  const ORIGINAL = {
    titulo: document.title,
    favicon: $('[data-favicon]')?.getAttribute('href'),
    sello: $('[data-sello]')?.textContent,
    marquesina: $('[data-marquesina]')?.innerHTML,
    tituloMenu: $('[data-titulo-menu]')?.textContent
  };
  const VARIABLES = {
    char: '--char', char2: '--char-2', mustard: '--mustard', mustard2: '--mustard-2', ketchup: '--ketchup',
    ketchup2: '--ketchup-2', promo: '--promo-bg', cinta: '--cinta-bg', brillo: '--brillo'
  };
  const anios = (n) => (n === 1 ? '1 año' : `${n} años`);
  const rellenar = (texto, n) => String(texto).replaceAll('{anios}', anios(n)).replaceAll('{ANIOS}', anios(n).toUpperCase());
  const iconoEmoji = (e) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="88">${e}</text></svg>`)}`;
  let temaPintado = null;

  /** fest = { tema, variante (1-3), numero (aniversario) } calculado por la base de datos */
  function aplicarTema(fest, conIntro = true) {
    const t = (window.QB_TEMAS ?? {})[fest?.tema];
    const nVar = Math.min(Math.max(Number(fest?.variante) || 1, 1), t ? t.variantes.length : 1);
    const v = t ? t.variantes[nVar - 1] : null;
    const n = Number(fest?.numero) || 1;
    const clave = v ? `${fest.tema}:${nVar}:${n}` : 'normal';
    if (clave === temaPintado) return;
    temaPintado = clave;

    const raiz = document.documentElement;
    if (v) { raiz.dataset.tema = fest.tema; raiz.dataset.variante = String(nVar); }
    else { delete raiz.dataset.tema; delete raiz.dataset.variante; }
    Object.entries(VARIABLES).forEach(([clave2, css]) => {
      if (v?.colores?.[clave2]) raiz.style.setProperty(css, v.colores[clave2]);
      else raiz.style.removeProperty(css);
    });

    const cinta = $('[data-cinta]');
    if (cinta) { cinta.textContent = v ? rellenar(v.cinta, n) : ''; cinta.hidden = !v; }
    $$('[data-sticker]').forEach((s) => { s.textContent = v?.icono ?? ''; s.hidden = !v; });
    const sello = $('[data-sello]');
    if (sello) sello.textContent = v ? rellenar(v.sello, n) : ORIGINAL.sello;
    const marquesina = $('[data-marquesina]');
    if (marquesina) {
      marquesina.innerHTML = v
        ? [0, 1].map(() => v.marquesina.map((x) => `<span>${escapar(rellenar(x, n))}</span><i>${v.icono}</i>`).join('')).join('')
        : ORIGINAL.marquesina;
    }
    const favicon = $('[data-favicon]');
    if (favicon) {
      favicon.type = v ? 'image/svg+xml' : 'image/png';
      favicon.href = v ? iconoEmoji(v.icono) : ORIGINAL.favicon;
    }
    document.title = v ? `${v.icono} ${ORIGINAL.titulo}` : ORIGINAL.titulo;

    pintarEscena(v, fest?.tema, n, t, conIntro);
  }

  /* Escena ilustrada (js/escenas.js): guirnalda, cielo, suelo, figura junto a la
     hamburguesa, adorno del título, borde y patrón del menú, y la bienvenida. */
  function pintarEscena(v, tema, n, t, conIntro) {
    const raiz = document.documentElement;
    const e = v && window.QB_ESCENAS ? window.QB_ESCENAS.construir(v, tema, n) : null;
    const poner = (sel, html) => $$(sel).forEach((el) => { el.innerHTML = html; el.hidden = !html; });
    poner('[data-decoracion]', e ? e.guirnalda + e.cielo + e.suelo : '');
    poner('[data-figura]', e?.figura ?? '');
    poner('[data-menu-figura]', e?.figura ?? '');
    poner('[data-titulo-extra]', e?.titulo ?? '');
    poner('[data-borde-menu]', e?.borde ?? '');
    [['--patron-menu', e?.patron], ['--patron-claro', e?.patronClaro], ['--ornamento', e?.ornamento]].forEach(([css, valor]) => {
      if (valor && valor !== 'none') raiz.style.setProperty(css, valor); else raiz.style.removeProperty(css);
    });
    const tituloMenu = $('[data-titulo-menu]');
    if (tituloMenu) tituloMenu.textContent = e && t.menu ? rellenar(t.menu, n) : ORIGINAL.tituloMenu;
    if (e && conIntro) mostrarBienvenida(e.intro, rellenar(t.saludo ?? t.nombre, n), `${tema}:${v.escena}:${n}`);
  }

  /** Pantalla de bienvenida: una vez por visita y por festividad; se cierra sola o con un toque. */
  function mostrarBienvenida(arte, saludo, clave) {
    try {
      if (sessionStorage.getItem('qb_bienvenida') === clave) return;
      sessionStorage.setItem('qb_bienvenida', clave);
    } catch { /* sin almacenamiento: se muestra igual */ }
    $('.bienvenida')?.remove();
    const capa = document.createElement('div');
    capa.className = 'bienvenida';
    capa.setAttribute('aria-hidden', 'true');
    capa.innerHTML = `<div class="bienvenida-caja"><div class="bienvenida-arte">${arte}</div>
      <p class="bienvenida-saludo">${escapar(saludo)}</p><p class="bienvenida-sub">Quechimba Burger está de fiesta</p></div>`;
    document.body.append(capa);
    let cerrada = false;
    const eventos = ['keydown', 'wheel', 'touchstart'];
    const cerrar = () => {
      if (cerrada) return;
      cerrada = true;
      capa.classList.add('se-va');
      setTimeout(() => capa.remove(), 600);
      eventos.forEach((ev) => removeEventListener(ev, cerrar));
    };
    capa.addEventListener('click', cerrar);
    eventos.forEach((ev) => addEventListener(ev, cerrar, { passive: true }));
    setTimeout(cerrar, 2600);
  }
  window.QB_aplicarTema = (f) => aplicarTema(f, false); // lo usan las pruebas automáticas (sin bienvenida)

  let menuDibujado = false;
  const aplicarMenu = () => {
    menuDibujado = true;
    aplicarTema(festividad);
    pintarMenu();
    pintarPortada();
    pintarPreciosSueltos();
    const quitados = depurarCarrito();
    productos.forEach((p) => pintarAccion(p.id));
    pintarCarrito();
    pintarAvisoPausa();
    if (quitados.length) avisar(`Se quitó de tu pedido (agotado o cambió): <b>${escapar(quitados.join(', '))}</b>`);
  };

  // 1) Arranque inmediato con el último menú conocido (o el de config.js)
  let menuGuardado = conSupabase ? almacen.leer(KEY_MENU, null) : null;
  if (menuGuardado?.datos) usarMenu(menuGuardado.datos);

  // 2) Menú actualizado desde Supabase; si falla, el sitio sigue funcionando igual
  async function refrescarMenu() {
    if (!conSupabase) return;
    try {
      const nuevo = desdeServidor(await rpc('menu_publico'));
      if (!nuevo.productos.length) return;
      const cambio = JSON.stringify(nuevo) !== JSON.stringify(menuGuardado?.datos ?? null);
      menuGuardado = { t: Date.now(), datos: nuevo };
      almacen.guardar(KEY_MENU, menuGuardado);
      usarMenu(nuevo);
      if (cambio) aplicarMenu(); else { pintarAvisoPausa(); aplicarTema(festividad); }
    } catch (e) {
      console.warn('Menú en línea no disponible; se usa el guardado.', e.message);
    }
  }

  /* ---------- Panel del pedido ---------- */
  const panel = $('[data-drawer]');
  const abrirPanel = () => { if (!panel.open) panel.showModal(); };
  const cerrarPanel = () => { if (panel.open) panel.close(); };

  $$('[data-open-cart]').forEach((b) => b.addEventListener('click', abrirPanel));
  $$('[data-close-cart]').forEach((b) => b.addEventListener('click', cerrarPanel));
  $('[data-go-menu]')?.addEventListener('click', () => $('#menu').scrollIntoView({ behavior: 'smooth' }));
  // Cerrar al tocar fuera del panel
  panel.addEventListener('click', (e) => { if (e.target === panel) cerrarPanel(); });

  /* ---------- Formulario y envío por WhatsApp ---------- */
  const form = $('[data-checkout]');
  const selectPago = $('[data-pagos]');
  selectPago.innerHTML = negocio.mediosDePago.map((m) => `<option>${escapar(m)}</option>`).join('');
  $('[data-nota-domicilio]').textContent = negocio.notaDomicilio;

  const campoDireccion = $('[data-solo-domicilio]');
  const actualizarEntrega = () => {
    const domicilio = form.entrega.value === 'Domicilio';
    campoDireccion.hidden = !domicilio;
    form.direccion.required = domicilio;
    $('[data-nota-domicilio]').hidden = !domicilio;
  };

  // Recordar datos del cliente para su próximo pedido
  const cliente = almacen.leer(KEY_CLIENTE, {});
  ['nombre', 'direccion', 'pago', 'entrega'].forEach((k) => { if (cliente[k]) form[k].value = cliente[k]; });
  actualizarEntrega();
  form.addEventListener('change', (e) => { if (e.target.name === 'entrega') actualizarEntrega(); });
  form.addEventListener('input', (e) => e.target.closest('.field')?.classList.remove('is-invalid'));

  const validar = () => {
    let primero = null;
    ['nombre', 'direccion'].forEach((k) => {
      const input = form[k];
      const malo = input.required && !input.value.trim();
      input.closest('.field').classList.toggle('is-invalid', malo);
      input.setAttribute('aria-invalid', String(malo));
      if (malo && !primero) primero = input;
    });
    primero?.focus();
    return !primero;
  };

  const armarMensaje = (datos, registro = null) => {
    // Si el pedido quedó registrado, se usan los valores calculados por el servidor
    const lineasPedido = registro
      ? registro.items.map((i) => ({ nombre: i.nombre, n: i.cantidad, valor: i.subtotal, detalle: i.detalle }))
      : [...carrito].map(([clave, n]) => {
        const { id, elegidas } = leerLinea(clave);
        const p = productoPorId.get(id);
        return { nombre: p.nombre, n, valor: precioLinea(clave) * n, detalle: detalleDe(p, elegidas) };
      });
    const subtotal = registro ? registro.subtotal : totales().subtotal;
    const items = lineasPedido.map((l) => `• ${l.n} x ${l.nombre} — ${precio(l.valor)}${l.detalle ? `\n   ↳ ${l.detalle}` : ''}`);
    const domicilio = datos.entrega === 'Domicilio';
    return [
      `¡Hola, ${negocio.nombre}! 🍔`,
      registro ? `*Pedido #${String(registro.numero).padStart(4, '0')}*` : null,
      'Quiero hacer este pedido:',
      '',
      ...items,
      '',
      `*Subtotal:* ${precio(subtotal)}${domicilio ? ' + domicilio' : ''}`,
      `*Entrega:* ${datos.entrega}`,
      `*Nombre:* ${datos.nombre}`,
      domicilio ? `*Dirección:* ${datos.direccion}` : null,
      `*Pago:* ${datos.pago}`,
      datos.notas ? `*Notas:* ${datos.notas}` : null
    ].filter((l) => l !== null).join('\n');
  };

  const PAGOS = { efectivo: 'efectivo', nequi: 'nequi', daviplata: 'daviplata', transferencia: 'transferencia', tarjeta: 'tarjeta' };
  const ERRORES_NEGOCIO = ['PEDIDOS_PAUSADOS', 'PRODUCTO_NO_DISPONIBLE', 'PRODUCTO_NO_EXISTE', 'DATO_INVALIDO', 'DEMASIADOS_PEDIDOS', 'PEDIDO_VACIO',
    'OPCIONES_INCOMPLETAS', 'OPCION_NO_EXISTE'];
  let enviando = false;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (enviando || !carrito.size || !validar() || !pedidosWebActivos) return;
    const datos = Object.fromEntries(['entrega', 'nombre', 'direccion', 'pago', 'notas'].map((k) => [k, form[k].value.trim()]));
    almacen.guardar(KEY_CLIENTE, { nombre: datos.nombre, direccion: datos.direccion, pago: datos.pago, entrega: datos.entrega });

    if (!conSupabase) {
      window.open(linkWhatsApp(armarMensaje(datos)), '_blank', 'noopener');
      avisar('Abriendo WhatsApp…');
      return;
    }

    // La pestaña se abre YA (dentro del clic) para que el navegador no la bloquee
    const ventana = window.open('', '_blank');
    if (ventana) ventana.opener = null;
    let registro = null;
    enviando = true;
    $('[data-enviar]').disabled = true;
    try {
      registro = await rpc('crear_pedido_web', {
        p_items: [...carrito].map(([clave, cantidad]) => {
          const { id, elegidas } = leerLinea(clave);
          return elegidas ? { slug: id, cantidad, opciones: elegidas } : { slug: id, cantidad };
        }),
        p_cliente: {
          nombre: datos.nombre,
          tipo_entrega: datos.entrega === 'Domicilio' ? 'domicilio' : 'recoger',
          direccion: datos.entrega === 'Domicilio' ? datos.direccion : '',
          metodo_pago: PAGOS[normalizar(datos.pago)] ?? 'otro',
          notas: datos.notas
        }
      }, 8000);
    } catch (err) {
      // Errores del negocio: se informa y NO se envía. Fallas de red: se envía solo por WhatsApp.
      if (ERRORES_NEGOCIO.includes(err.hint)) {
        ventana?.close();
        avisar(escapar(err.message));
        if (err.hint !== 'DATO_INVALIDO') refrescarMenu();
        return;
      }
      console.warn('No se pudo registrar el pedido en línea; se envía solo por WhatsApp.', err.message);
    } finally {
      enviando = false;
      $('[data-enviar]').disabled = !pedidosWebActivos;
    }

    const url = linkWhatsApp(armarMensaje(datos, registro));
    if (ventana) ventana.location.href = url; else location.href = url;
    if (registro) {
      // Pedido registrado: se vacía el carrito para no enviarlo dos veces por error
      const ids = [...new Set([...carrito.keys()].map((c) => leerLinea(c).id))];
      carrito.clear();
      guardarCarrito();
      ids.forEach(pintarAccion);
      pintarCarrito();
      cerrarPanel();
    }
    avisar(registro ? `Pedido <b>#${String(registro.numero).padStart(4, '0')}</b> registrado · abriendo WhatsApp…` : 'Abriendo WhatsApp…');
  });

  /* ---------- Ventanita de opciones: elegir bebida, preparación, nivel… ---------- */
  const dlgOpc = $('[data-opciones]');
  const formOpc = $('[data-opciones-form]');
  let opcActual = null;
  const leerElegidas = () => opcActual.opciones.map((g, i) => (g.elige === 1
    ? [formOpc.querySelector(`input[name="g${i}"]:checked`)?.value].filter(Boolean)
    : $$(`select[name^="g${i}-"]`, formOpc).map((s) => s.value).filter(Boolean)));
  const actualizarOpciones = () => {
    const elegidas = leerElegidas();
    const completo = opcActual.opciones.every((g, i) => elegidas[i].length === g.elige);
    $('[data-opc-precio]').textContent = precio(opcActual.precio + extraDe(opcActual, elegidas));
    $('[data-opc-agregar]').disabled = !completo;
    opcActual.opciones.forEach((g, i) => {
      $(`[data-opc-falta="${i}"]`).hidden = elegidas[i].length === g.elige;
    });
  };
  function abrirOpciones(id) {
    const p = productoPorId.get(id);
    if (!p || p.agotado || !pedidosWebActivos || !dlgOpc) return;
    opcActual = p;
    $('[data-opc-foto]').src = foto(p.foto, 600, 450);
    $('[data-opc-nombre]').textContent = p.nombre;
    $('[data-opc-desc]').textContent = p.descripcion;
    $('[data-opc-grupos]').innerHTML = p.opciones.map((g, i) => {
      const lista = opcionesDe(g);
      const ayuda = `<small class="opc-falta" data-opc-falta="${i}">Elige ${g.elige === 1 ? 'una' : g.elige}</small>`;
      if (g.elige === 1) {
        const marcada = g.lista ? null : lista[0]?.nombre; // lo básico ya viene marcado; la bebida se elige
        return `<fieldset class="opc-grupo"><legend>${escapar(g.titulo)} ${ayuda}</legend><div class="opc-chips">${lista.map((o) => `
          <label class="opc-chip"><input type="radio" name="g${i}" value="${escapar(o.nombre)}" ${o.nombre === marcada ? 'checked' : ''}>
            <span>${escapar(o.nombre)}${o.extra ? ` <em>+${precio(o.extra)}</em>` : ''}</span></label>`).join('')}</div></fieldset>`;
      }
      const singular = g.lista === 'gaseosas' ? 'Gaseosa' : 'Opción';
      return `<fieldset class="opc-grupo"><legend>${escapar(g.titulo)} ${ayuda}</legend><div class="opc-selects">${Array.from({ length: g.elige }, (_, k) => `
        <label class="field"><span>${singular} ${k + 1}</span><select name="g${i}-${k}"><option value="">Elige…</option>${lista.map((o) =>
          `<option value="${escapar(o.nombre)}">${escapar(o.nombre)}${o.extra ? ` (+${precio(o.extra)})` : ''}</option>`).join('')}</select></label>`).join('')}</div></fieldset>`;
    }).join('');
    actualizarOpciones();
    dlgOpc.showModal();
  }
  formOpc?.addEventListener('change', actualizarOpciones);
  formOpc?.addEventListener('submit', (e) => {
    e.preventDefault();
    const elegidas = leerElegidas();
    if (!opcActual || !eleccionValida(opcActual, elegidas)) return;
    cambiarCantidad(claveLinea(opcActual.id, elegidas), 1);
    dlgOpc.close();
  });
  $$('[data-opciones-cerrar]').forEach((b) => b.addEventListener('click', () => dlgOpc.close()));
  dlgOpc?.addEventListener('click', (e) => { if (e.target === dlgOpc) dlgOpc.close(); });

  /* ---------- Aviso flotante ---------- */
  const toast = $('[data-toast]');
  let toastTimer;
  const soportaPopover = typeof toast.showPopover === 'function';
  function avisar(html) {
    toast.innerHTML = html;
    // Como "popover" se muestra por encima del panel del pedido abierto
    if (soportaPopover) {
      if (toast.matches(':popover-open')) toast.hidePopover();
      toast.showPopover();
    }
    toast.classList.remove('is-on');
    void toast.offsetWidth;
    toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('is-on');
      if (soportaPopover) setTimeout(() => toast.matches(':popover-open') && toast.hidePopover(), 300);
    }, 2400);
  }

  /* ---------- Menú: primer dibujo y actualización en línea ---------- */
  if (conSupabase && !menuGuardado) {
    // Primera visita: se espera el menú real (precios al día) hasta 1,5 s para no
    // mostrar precios viejos ni redibujar mientras el cliente toca; si no llega, config.js.
    const respaldo = setTimeout(() => { if (!menuDibujado) aplicarMenu(); }, 1500);
    refrescarMenu().finally(() => { clearTimeout(respaldo); if (!menuDibujado) aplicarMenu(); });
  } else {
    aplicarMenu();      // visitas siguientes: instantáneo con el último menú guardado
    refrescarMenu();
  }
  // Respaldo cada minuto, por si el canal en vivo no está disponible
  setInterval(refrescarMenu, 60_000);

  /* ---------- Cambios en vivo (Supabase Realtime) ----------
     Cuando el dueño cambia el menú, un precio, el destacado o desactiva la web
     desde la app, la base de datos avisa por un canal público y la web vuelve a
     pedir el menú AL INSTANTE, sin recargar. El aviso no trae datos: el menú
     siempre se pide a menu_publico(). Conexión mínima, sin librerías. */
  let refrescoPendiente;
  const refrescarPronto = () => { clearTimeout(refrescoPendiente); refrescoPendiente = setTimeout(refrescarMenu, 50); };

  function escucharCambios() {
    if (!conSupabase || typeof WebSocket !== 'function') return;
    const TEMA = 'realtime:menu-publico';
    const url = `${SB.url.replace(/\/$/, '').replace(/^http/, 'ws')}/realtime/v1/websocket?apikey=${encodeURIComponent(SB.anonKey)}&vsn=1.0.0`;
    let ws;
    let latido;
    let reintento = 1000;
    let ref = 0;
    let yaConecto = false;
    const enviar = (topic, event, payload) => {
      if (ws?.readyState === 1) ws.send(JSON.stringify({ topic, event, payload, ref: String(++ref) }));
    };
    const conectar = () => {
      try { ws = new WebSocket(url); } catch { return; }
      ws.onopen = () => {
        reintento = 1000;
        enviar(TEMA, 'phx_join', { config: { broadcast: { self: false, ack: false }, presence: { key: '' }, postgres_changes: [], private: false } });
        latido = setInterval(() => enviar('phoenix', 'heartbeat', {}), 25_000);
        if (yaConecto) refrescarMenu(); // al reconectar: pudo haber cambios mientras no había internet
        yaConecto = true;
      };
      ws.onmessage = (e) => {
        try {
          const m = JSON.parse(e.data);
          if (m.topic === TEMA && m.event === 'broadcast') refrescarPronto();
        } catch { /* mensaje ajeno */ }
      };
      ws.onclose = () => {
        clearInterval(latido);
        setTimeout(conectar, reintento);
        reintento = Math.min(reintento * 2, 30_000); // reintentos cada vez más espaciados
      };
      ws.onerror = () => ws.close();
    };
    conectar();
  }
  escucharCambios();
  // Al volver a la pestaña (ej. el cliente cambió de app en el celular), traer lo último
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refrescarPronto(); });

  /* ---------- Navegación ---------- */
  const header = $('[data-header]');
  const nav = $('[data-nav]');
  const toggle = $('[data-nav-toggle]');
  const abrirNav = (abierto) => {
    nav.classList.toggle('is-open', abierto);
    toggle.setAttribute('aria-expanded', String(abierto));
    toggle.setAttribute('aria-label', abierto ? 'Cerrar menú' : 'Abrir menú');
  };
  toggle.addEventListener('click', () => abrirNav(!nav.classList.contains('is-open')));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) abrirNav(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') abrirNav(false); });
  document.addEventListener('click', (e) => { if (!header.contains(e.target)) abrirNav(false); });

  const marcarScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  marcarScroll();
  window.addEventListener('scroll', marcarScroll, { passive: true });

  /* ---------- Animación al aparecer ---------- */
  const revelables = $$('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entradas) => {
      entradas.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revelables.forEach((el) => io.observe(el));
  } else {
    revelables.forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- Datos para Google (SEO) ---------- */
  const ld = document.createElement('script');
  ld.type = 'application/ld+json';
  ld.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: negocio.nombre,
    servesCuisine: ['Hamburguesas', 'Salchipapas', 'Comida rápida'],
    telephone: `+${negocio.whatsapp}`,
    email: negocio.correo || undefined,
    priceRange: '$$',
    address: { '@type': 'PostalAddress', streetAddress: `${negocio.direccion}, ${negocio.barrio}`, addressLocality: negocio.ciudad.split(',')[0].trim(), addressRegion: (negocio.ciudad.split(',')[1] ?? '').trim(), addressCountry: 'CO' },
    logo: new URL('assets/img/logo.webp', location.href).href,
    image: new URL('assets/img/hero-quechimba.webp', location.href).href,
    sameAs: [negocio.instagram, negocio.facebook].filter(Boolean),
    openingHoursSpecification: horario.map((t) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: `https://schema.org/${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][t.dia]}`,
      opens: t.abre,
      closes: t.cierra
    }))
  });
  document.head.appendChild(ld);
})();
