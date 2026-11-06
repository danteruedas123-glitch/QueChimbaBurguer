/* =====================================================================
   QUECHIMBA BURGER — Lógica del sitio
   Lee los datos de js/config.js. No es necesario editar este archivo
   para cambiar precios, productos u horarios.
   ===================================================================== */
(() => {
  'use strict';

  const CFG = window.QB_CONFIG;
  if (!CFG) return;

  const { negocio, horario, categorias, productos } = CFG;
  const KEY_CARRITO = 'qb_carrito_v1';
  const KEY_CLIENTE = 'qb_cliente_v1';

  /* ---------- Utilidades ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const productoPorId = new Map(productos.map((p) => [p.id, p]));

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
  $$('[data-precio-de]').forEach((el) => {
    const p = productoPorId.get(el.dataset.precioDe);
    if (p) el.textContent = precio(p.precio); else el.hidden = true;
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
    <article class="dish" data-id="${escapar(p.id)}" data-texto="${escapar(normalizar(`${p.nombre} ${p.descripcion} ${p.etiqueta ?? ''}`))}">
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
          <span class="dish-price">${precio(p.precio)}</span>
          <div class="dish-action" data-action-for="${escapar(p.id)}"></div>
        </div>
      </div>
    </article>`;

  // Las fotos de cada categoría solo se descargan al abrirla (ahorra datos)
  if (menu) {
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
  }

  const grupos = $$('.cat', menu);
  let buscando = false;
  let abiertaAntes = null;

  // Al abrir una categoría, llevarla arriba para que se vean sus productos
  grupos.forEach((g) => g.addEventListener('toggle', () => {
    if (!g.open || buscando) return;
    requestAnimationFrame(() => {
      const top = g.getBoundingClientRect().top;
      const header = $('[data-header]').offsetHeight;
      if (top < header || top > window.innerHeight * 0.45) g.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }));

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

  /* ---------- Franja destacada ---------- */
  const promoCfg = CFG.promo ?? {};
  const promo = productoPorId.get(promoCfg.producto);
  if (promo) {
    const cat = categorias.find((c) => c.id === promo.categoria);
    $('[data-promo-title]').textContent = promoCfg.titulo ?? 'Destacado';
    $('[data-promo-name]').textContent = promo.nombre;
    $('[data-promo-desc]').textContent = promo.descripcion;
    $('[data-promo-price]').textContent = precio(promo.precio);
    $('[data-promo-tag]').textContent = promo.etiqueta ?? '';
    const img = $('[data-promo-img]');
    img.src = promoCfg.foto || foto(promo.foto, 720, 608);
    img.alt = promo.nombre;
    $('.promo [data-action-for]').dataset.actionFor = promo.id;
    const enlace = $('[data-promo-link]');
    if (cat) {
      enlace.dataset.abrirCat = cat.id;
      enlace.querySelector('span').textContent = `Ver todas las opciones de ${cat.nombre.toLowerCase()}`;
    } else {
      enlace.hidden = true;
    }
  } else {
    $('#destacado')?.remove();
  }

  /* ---------- Carrito ---------- */
  const carrito = new Map(
    Object.entries(almacen.leer(KEY_CARRITO, {}))
      .filter(([id, n]) => productoPorId.has(id) && Number.isInteger(n) && n > 0)
  );

  const totales = () => {
    let unidades = 0;
    let subtotal = 0;
    carrito.forEach((n, id) => { unidades += n; subtotal += n * productoPorId.get(id).precio; });
    return { unidades, subtotal };
  };

  const controlCantidad = (p, n) => `
    <div class="stepper" role="group" aria-label="Cantidad de ${escapar(p.nombre)}">
      <button type="button" data-dec="${escapar(p.id)}" aria-label="Quitar una ${escapar(p.nombre)}">${icono('minus')}</button>
      <output aria-live="polite">${n}</output>
      <button type="button" data-inc="${escapar(p.id)}" aria-label="Agregar otra ${escapar(p.nombre)}">${icono('plus')}</button>
    </div>`;

  const pintarAccion = (id) => {
    const p = productoPorId.get(id);
    const n = carrito.get(id) ?? 0;
    $$(`[data-action-for="${CSS.escape(id)}"]`).forEach((caja) => {
      caja.innerHTML = n
        ? controlCantidad(p, n)
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
      carrito.forEach((q, id) => { if (productoPorId.get(id).categoria === el.dataset.catBadge) n += q; });
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

    lineas.innerHTML = [...carrito].map(([id, n]) => {
      const p = productoPorId.get(id);
      return `
        <li class="line">
          <img src="${escapar(foto(p.foto, 120, 120))}" width="60" height="60" alt="">
          <div class="line-info"><strong>${escapar(p.nombre)}</strong><span>${precio(p.precio)} c/u</span></div>
          <span class="line-total">${precio(p.precio * n)}</span>
          ${controlCantidad(p, n)}
        </li>`;
    }).join('');
  };

  const guardarCarrito = () => almacen.guardar(KEY_CARRITO, Object.fromEntries(carrito));

  const botonCarrito = $('.cart-btn');
  const cambiarCantidad = (id, delta) => {
    const p = productoPorId.get(id);
    if (!p) return;
    const antes = carrito.get(id) ?? 0;
    const n = Math.max(0, Math.min(99, antes + delta));
    if (n) carrito.set(id, n); else carrito.delete(id);
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
    const ids = [...carrito.keys()];
    carrito.clear();
    guardarCarrito();
    ids.forEach(pintarAccion);
    pintarCarrito();
    $('[data-close-cart]').focus();
    avisar('Pedido vaciado');
  });

  productos.forEach((p) => pintarAccion(p.id));
  pintarCarrito();

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

  const armarMensaje = (datos) => {
    const { subtotal } = totales();
    const items = [...carrito].map(([id, n]) => {
      const p = productoPorId.get(id);
      return `• ${n} x ${p.nombre} — ${precio(p.precio * n)}`;
    });
    const domicilio = datos.entrega === 'Domicilio';
    return [
      `¡Hola, ${negocio.nombre}! 🍔`,
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

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!carrito.size || !validar()) return;
    const datos = Object.fromEntries(['entrega', 'nombre', 'direccion', 'pago', 'notas'].map((k) => [k, form[k].value.trim()]));
    almacen.guardar(KEY_CLIENTE, { nombre: datos.nombre, direccion: datos.direccion, pago: datos.pago, entrega: datos.entrega });
    window.open(linkWhatsApp(armarMensaje(datos)), '_blank', 'noopener');
    avisar('Abriendo WhatsApp…');
  });

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
