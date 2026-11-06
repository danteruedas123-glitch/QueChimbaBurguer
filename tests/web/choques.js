/**
 * Revisión de "nada tapa nada" para las festividades. Se ejecuta DENTRO de la
 * página (page.evaluate) y devuelve la lista de choques encontrados.
 *  • Lo que se pinta ENCIMA del contenido (figura junto a la hamburguesa, adornos
 *    del título, figura y adornos del menú) no puede tocar nada importante ni
 *    salirse de su caja o de la pantalla.
 *  • Lo que va de FONDO (cielo, guirnalda, suelo) queda detrás del sello y del
 *    ticket, pero no puede quedar detrás de textos ni botones (legibilidad).
 * Usar con "reducir movimiento" emulado para medir todo en reposo.
 */
export async function buscarChoques() {
    const caja = (r) => ({ l: r.left, t: r.top + scrollY, r: r.right, b: r.bottom + scrollY });
    const vacia = (c) => !c || c.r - c.l < 1 || c.b - c.t < 1;
    const union = (cs) => cs.filter((c) => !vacia(c)).reduce((a, c) => (a ? { l: Math.min(a.l, c.l), t: Math.min(a.t, c.t), r: Math.max(a.r, c.r), b: Math.max(a.b, c.b) } : c), null);
    const brillo = /url\(#qb-(brillo|luz|halo)/;
    // Área pintada de un dibujo: unión de sus formas (sin los halos de luz difusos)
    const pintado = (el) => {
      const formas = [...el.querySelectorAll('path, circle, ellipse, rect, text, polygon')]
        .filter((f) => !brillo.test(f.getAttribute('fill') ?? '') && !f.closest('defs') && getComputedStyle(f).opacity !== '0');
      return union(formas.map((f) => caja(f.getBoundingClientRect())));
    };
    const textoDe = (nodo) => { const rg = document.createRange(); rg.selectNodeContents(nodo); return [...rg.getClientRects()].map(caja); };
    const protegidos = () => {
      const lista = [];
      const add = (nombre, cajas) => cajas.forEach((c) => !vacia(c) && lista.push({ nombre, c }));
      ['.hero-seal', '.hero-ticket', '.status-pill--hero', '[data-cinta]', '.marquee', '.menu-tools'].forEach((s) => document.querySelectorAll(s).forEach((e) => add(s, [caja(e.getBoundingClientRect())])));
      ['.section-head h2', '.menu-count'].forEach((s) => document.querySelectorAll(s).forEach((e) => add(s, textoDe(e))));
      document.querySelectorAll('.hero-ctas .btn, .hero-facts li').forEach((e) => add(e.matches('.btn') ? 'botón portada' : 'dato portada', [caja(e.getBoundingClientRect())]));
      const h1 = document.querySelector('.hero h1');
      [...h1.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).forEach((n) => add('título (líneas)', textoDe(n)));
      const em = h1.querySelector('em');
      add('palabra quechimba', textoDe([...em.childNodes].find((n) => n.nodeType === 3)));
      const cat = document.querySelector('.cat');
      ['.cat-thumb', '.cat-badge', '.cat-chev'].forEach((s) => cat?.querySelector(s) && add(`menú ${s}`, [caja(cat.querySelector(s).getBoundingClientRect())]));
      ['.cat-name', '.cat-meta'].forEach((s) => cat?.querySelector(s) && add(`menú ${s}`, textoDe(cat.querySelector(s))));
      return lista;
    };
    const adornos = () => {
      const lista = [];
      const heroC = caja(document.querySelector('.hero').getBoundingClientRect());
      const menuC = caja(document.querySelector('.menu-section').getBoundingClientRect());
      const recortar = (c, z) => c && ({ l: Math.max(c.l, z.l), t: Math.max(c.t, z.t), r: Math.min(c.r, z.r), b: Math.min(c.b, z.b) });
      const FONDO = ['.pieza-luna', '.pieza-sol-cielo', '.pieza-calavera-cielo', 'araña', 'telaraña', 'guirnalda', 'suelo', 'actor del suelo', 'bandera'];
      const add = (nombre, c, permitido = []) => {
        const enMenu = /menú|tarjeta/.test(nombre);
        c = recortar(c, enMenu ? menuC : heroC);
        if (vacia(c)) return;
        // Lo de fondo queda detrás del sello, el ticket y las tarjetas: solo importa que no quede detrás de textos y botones
        const soloTextos = FONDO.includes(nombre);
        lista.push({ nombre, c, permitido, soloTextos });
      };
      const fig = document.querySelector('[data-figura]:not([hidden])');
      if (fig) add('figura junto a la burger', pintado(fig));
      ['.pieza-luna', '.pieza-sol-cielo', '.pieza-calavera-cielo'].forEach((s) => document.querySelectorAll(s).forEach((e) => add(s, pintado(e))));
      document.querySelectorAll('.arana').forEach((e) => add('araña', pintado(e)));
      document.querySelectorAll('.telarana').forEach((e) => add('telaraña', pintado(e)));
      document.querySelectorAll('.capa-guirnalda > svg').forEach((e) => add('guirnalda', pintado(e)));
      document.querySelectorAll('.capa-guirnalda--tira').forEach((e) => add('guirnalda', caja(e.getBoundingClientRect())));
      document.querySelectorAll('.escena-suelo').forEach((e) => [...e.children].forEach((g) => g.tagName !== 'defs' && add('suelo', union([...(g.matches('path,circle,ellipse,rect,text') ? [g] : [])].map((f) => caja(f.getBoundingClientRect())).concat(pintado(g) ? [pintado(g)] : [])))));
      document.querySelectorAll('.actor').forEach((e) => add('actor del suelo', pintado(e)));
      document.querySelectorAll('.bandera-ondea').forEach((e) => add('bandera', caja(e.getBoundingClientRect())));
      document.querySelectorAll('[data-titulo-extra] svg, [data-titulo-extra] i').forEach((e) => add('adorno del título', pintado(e) ?? caja(e.getBoundingClientRect()), ['palabra quechimba']));
      document.querySelectorAll('[data-menu-figura]:not([hidden])').forEach((e) => add('figura del menú', pintado(e)));
      document.querySelectorAll('[data-borde-menu]:not([hidden]) svg').forEach((e) => add('borde del menú', caja(e.getBoundingClientRect()), ['.marquee']));
      const cat = document.querySelector('.cat');
      if (cat) {
        const st = getComputedStyle(cat, '::after');
        if (st.content !== 'none' && st.backgroundImage !== 'none') {
          const rc = cat.getBoundingClientRect();
          const w = parseFloat(st.width); const h = parseFloat(st.height);
          const right = parseFloat(st.right); const top = parseFloat(st.top);
          add('adorno de la tarjeta', caja({ left: rc.right - right - w, right: rc.right - right, top: rc.top + top, bottom: rc.top + top + h }));
        }
      }
      return lista;
    };
    const choque = (a, b) => Math.min(a.r, b.r) - Math.max(a.l, b.l) > 2 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 2;
    const fallos = [];
    const temas = Object.entries(window.QB_TEMAS);
    for (const [tema, t] of temas) {
      for (let i = 0; i < t.variantes.length; i++) {
        window.QB_aplicarTema({ tema, variante: i + 1, numero: 12 });
        await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(ok, 30))));
        const P = protegidos();
        for (const a of adornos()) {
          for (const p of P) {
            if (a.permitido.includes(p.nombre)) continue;
            if (a.soloTextos && !['título (líneas)', 'palabra quechimba', '.status-pill--hero', 'botón portada', 'dato portada'].includes(p.nombre)) continue;
            if (choque(a.c, p.c)) fallos.push(`${tema} ${i + 1}: ${a.nombre} tapa ${p.nombre}`);
          }
        }
        // Lo que va encima no se sale de su caja ni de la pantalla
        for (const sel of ['[data-figura]:not([hidden])', '[data-menu-figura]:not([hidden])']) {
          const el = document.querySelector(sel);
          if (!el) continue;
          const c = pintado(el); const k = caja(el.getBoundingClientRect());
          if (c && (c.l < k.l - 3 || c.r > k.r + 3 || c.t < k.t - 3 || c.b > k.b + 3)) fallos.push(`${tema} ${i + 1}: ${sel} se sale de su caja`);
        }
        document.querySelectorAll('[data-titulo-extra] svg, [data-titulo-extra] i').forEach((e) => {
          const c = caja(e.getBoundingClientRect());
          if (c.l < -1 || c.r > innerWidth - 4) fallos.push(`${tema} ${i + 1}: adorno del título se sale de la pantalla`);
        });
      }
    }
    window.QB_aplicarTema({ tema: 'normal' });
    return [...new Set(fallos)];
}
