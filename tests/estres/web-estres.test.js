/**
 * PRUEBAS DE ESTRÉS de la página web (copia local, nunca la web real):
 * inyección de código desde el menú, datos dañados en el navegador,
 * servidor caído o respondiendo basura, menú gigante, fugas de memoria,
 * doble envío, pantallas extremas, Edge, modo privado, teclado y accesibilidad.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { nuevaBase } from '../helpers/bd.js';
const MENU_REAL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../supabase/seed.sql');

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const WEB = process.env.QB_WEB_DIR ?? path.resolve(RAIZ, '..', 'WebQuechimbaburger');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((r) => existsSync(r));
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((r) => existsSync(r));
const SB_URL = 'https://prueba.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.firma';
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };

let servidor; let puerto; let navegador; let ctx;
let CSP = '';               // la misma política de seguridad que publica Netlify
let consultasMenu = 0;
let modo = 'normal'; // normal | caido | lento | basura | html500 | vacio | raro

function servir() {
  return new Promise((ok) => {
    servidor = http.createServer(async (req, res) => {
      const url = new URL(req.url, 'http://x');
      const ruta = path.join(WEB, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
      if (!ruta.startsWith(WEB)) { res.writeHead(403).end(); return; }
      try {
        let cuerpo = await readFile(ruta);
        if (url.pathname === '/js/config.js') {
          const conSb = req.headers.referer?.includes('sb=1');
          cuerpo = cuerpo.toString().replace(/url: '[^']*'/, `url: '${conSb ? SB_URL : ''}'`).replace(/anonKey: '[^']*'/, `anonKey: '${conSb ? SB_KEY : ''}'`);
        }
        const cab = { 'Content-Type': TIPOS[path.extname(ruta)] ?? 'application/octet-stream' };
        if (path.extname(ruta) === '.html' && CSP) cab['Content-Security-Policy'] = CSP;
        res.writeHead(200, cab).end(cuerpo);
      } catch { res.writeHead(404).end(); }
    }).listen(0, '127.0.0.1', () => { puerto = servidor.address().port; ok(); });
  });
}

async function abrir({ preparar, nav = navegador, ancho = 1280, alto = 900, movil = false, esperarMenu = true } = {}) {
  const contexto = await nav.createBrowserContext();
  const page = await contexto.newPage();
  page.close = () => contexto.close();
  await page.setViewport({ width: ancho, height: alto, isMobile: movil, hasTouch: movil });
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => { if (/Content Security Policy|Refused to/.test(m.text())) errores.push(`CSP: ${m.text().slice(0, 160)}`); });
  await page.evaluateOnNewDocument(() => {
    window.__ws = { conexiones: [] };
    window.WebSocket = class { constructor() { this.readyState = 0; window.__ws.conexiones.push(this); setTimeout(() => { this.readyState = 1; this.onopen?.(); }, 10); } send() {} close() { this.readyState = 3; } };
    window.__avisarCambio = (tabla) => window.__ws.conexiones.forEach((c) => c.onmessage?.({ data: JSON.stringify({ topic: 'realtime:menu-publico', event: 'broadcast', payload: { event: 'menu-cambio', payload: { tabla } } }) }));
    window.__whatsapp = [];
    window.open = (u) => { if (u) window.__whatsapp.push(u); return { opener: {}, close() {}, location: { set href(v) { window.__whatsapp.push(v); } } }; };
    try { sessionStorage.setItem('qb_bienvenida', 'x'); } catch { /* */ }
  });
  if (preparar) await page.evaluateOnNewDocument(preparar);
  await page.setRequestInterception(true);
  page.on('request', async (req) => {
    const url = req.url();
    const cors = { 'Access-Control-Allow-Origin': '*' };
    if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: { ...cors, 'Access-Control-Allow-Headers': 'apikey, authorization, content-type', 'Access-Control-Allow-Methods': 'POST' } });
    if (url.startsWith(SB_URL)) {
      if (modo === 'caido') return req.abort('connectionrefused');
      if (modo === 'html500') return req.respond({ status: 500, contentType: 'text/html', headers: cors, body: '<html><body>Internal Server Error</body></html>' });
      if (modo === 'basura') return req.respond({ status: 200, contentType: 'application/json', headers: cors, body: '{"productos": "esto no es una lista", "categorias": 42' });
      if (modo === 'vacio') return req.respond({ status: 200, contentType: 'application/json', headers: cors, body: '{}' });
      if (modo === 'raro') return req.respond({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ categorias: [{ slug: 'x' }], productos: [{ slug: 'p', precio: 'gratis', opciones: 'muchas' }, null, 7], bebidas: 'no' }) });
      if (modo === 'lento') await new Promise((r) => setTimeout(r, 9000));
      const fn = url.split('/rpc/')[1];
      if (fn === 'menu_publico') consultasMenu++;
      try {
        const datos = await ctx.base.rpc(fn, JSON.parse(req.postData() || '{}'), { rol: 'anon' });
        return req.respond({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(datos) });
      } catch (e) {
        return req.respond({ status: 400, contentType: 'application/json', headers: cors, body: JSON.stringify({ message: e.message, hint: e.hint, code: e.code }) });
      }
    }
    if (!url.startsWith(`http://127.0.0.1:${puerto}`)) return req.abort();
    return req.continue();
  });
  await page.goto(`http://127.0.0.1:${puerto}/?sb=1`, { waitUntil: 'domcontentloaded' });
  if (esperarMenu) await page.waitForSelector('.dish', { timeout: 15000 }).catch((e) => { throw new Error(`${e.message} · errores JS: ${JSON.stringify(errores)}`); });
  return { page, errores };
}

const abrirCat = async (page, slug) => {
  await page.$eval(`.cat[data-grupo="${slug}"]`, (d) => { d.open = true; });
  await page.waitForFunction((s) => [...document.querySelectorAll(`.cat[data-grupo="${s}"] .dish`)].every((d) => d.getBoundingClientRect().height > 0)
    && document.querySelector(`.cat[data-grupo="${s}"]`).getAnimations({ subtree: true }).every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity), { timeout: 5000, polling: 50 }, slug);
};

before(async () => {
  const toml = await readFile(path.join(WEB, 'netlify.toml'), 'utf8');
  CSP = (toml.match(/Content-Security-Policy = "([^"]+)"/)?.[1] ?? '').replaceAll('twnrwzvrxejstcwhsjvi.supabase.co', 'prueba.supabase.co');
  ctx = await nuevaBase({ semilla: MENU_REAL }); // el menú REAL del negocio
  await servir();
  navegador = await puppeteer.launch({ executablePath: CHROME ?? EDGE, headless: true });
});
after(async () => { await navegador?.close(); servidor?.close(); await ctx?.base.cerrar(); });

// ---------------------------------------------------------------- seguridad
describe('inyección de código (XSS) desde el menú', () => {
  test('nombres, descripciones, opciones, bebidas y portada con código malicioso: se muestran como texto, nunca se ejecutan', async () => {
    const MAL = '<img src=x onerror="window.__xss=(window.__xss||0)+1">';
    const [{ id: cat }] = await ctx.admin(`select id from public.categorias where slug = 'combos'`);
    await ctx.staff('categoria_guardar', { p: { nombre: `Cat ${MAL}`.slice(0, 40), orden: 99 } });
    const p = await ctx.staff('producto_guardar', { p: {
      categoria_id: cat, nombre: `Hack ${MAL}`.slice(0, 60), precio: 1000, descripcion: `<script>window.__xss=99</script>${MAL}`, etiqueta: '<b onmouseover=x>',
      opciones: [{ titulo: '<svg onload=x>', elige: 1, opciones: [{ nombre: MAL.slice(0, 40), extra: 0 }, { nombre: '"><script>x', extra: 500 }] }, { titulo: 'Gaseosa', elige: 1, lista: 'gaseosas' }],
    } });
    await ctx.staff('bebidas_guardar', { p: { gaseosas: ['Coca-Cola', MAL.slice(0, 40)] } });
    await ctx.staff('ajustes_guardar', { p: { producto_destacado_id: p.id, titulo_destacado: MAL.slice(0, 40) } });
    const { page, errores } = await abrir();
    await abrirCat(page, 'combos');
    await page.click(`[data-elegir="${p.slug}"]`);
    await page.waitForSelector('[data-opciones][open]');
    await page.click('input[name="g0"] + span');
    await page.click('input[name="g1"] + span');
    await page.click('[data-opc-agregar]');
    await page.click('.cart-btn');
    await page.waitForSelector('[name=nombre]', { visible: true });
    await page.$eval('[name=nombre]', (el, v) => { el.value = v; }, MAL);
    await page.$eval('[name=direccion]', (el) => { el.value = 'x'; });
    await page.$eval('[name=notas]', (el, v) => { el.value = v; }, MAL);
    await page.click('[data-enviar]');
    await page.waitForFunction(() => window.__whatsapp.some((u) => u.startsWith('https://wa.me/')), { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 500));
    const r = await page.evaluate(() => ({ xss: window.__xss ?? 0, imgs: document.querySelectorAll('img[src="x"]').length, scripts: [...document.scripts].filter((s) => s.textContent.includes('__xss')).length }));
    assert.deepEqual(r, { xss: 0, imgs: 0, scripts: 0 });
    assert.deepEqual(errores, []);
    await ctx.staff('ajustes_guardar', { p: { producto_destacado_id: null } });
    await ctx.staff('bebidas_guardar', { p: { gaseosas: ['Coca-Cola', 'Coca-Cola Zero', 'Postobón Manzana', 'Postobón Colombiana', 'Pepsi', 'Ginger'] } });
    await ctx.admin(`update public.productos set activo = false where id = $1`, [p.id]);
    await ctx.admin(`update public.categorias set activa = false where orden = 99`);
    await page.close();
  });
});

describe('política de seguridad de contenido (la misma de producción)', () => {
  test('la web funciona completa con la política activa y bloquea código inyectado', async () => {
    assert.match(CSP, /script-src 'self' 'sha256-/, 'netlify.toml tiene la política');
    const { page, errores } = await abrir();
    await abrirCat(page, 'combitos');
    await page.click('[data-elegir="combo-melo"]');
    await page.waitForSelector('[data-opciones][open]');
    await page.select('select[name="g0-0"]', 'Coca-Cola');
    await page.select('select[name="g0-1"]', 'Pepsi');
    await page.click('[data-opc-agregar]');
    await page.evaluate(() => { window.QB_aplicarTema({ tema: 'halloween', variante: 1 }); });
    assert.ok(await page.evaluate(() => document.documentElement.classList.contains('js')), 'el script de arranque autorizado corre');
    assert.deepEqual(errores, [], 'ninguna violación de la política en uso normal');
    const bloqueado = await page.evaluate(async () => {
      const s = document.createElement('script'); s.textContent = 'window.__inyectado = 1'; document.body.append(s);
      const d = document.createElement('div'); d.innerHTML = '<img src=x onerror="window.__inyectado = 2">'; document.body.append(d);
      await new Promise((r) => setTimeout(r, 500));
      return window.__inyectado === undefined;
    });
    assert.ok(bloqueado, 'el código inyectado NO se ejecuta');
    await page.close();
  });

  test('inundación del canal en vivo: 500 avisos falsos seguidos → pocas consultas del menú y nunca se congela', async () => {
    const { page, errores } = await abrir();
    await new Promise((r) => setTimeout(r, 2200));
    consultasMenu = 0;
    await page.evaluate(async () => { for (let i = 0; i < 500; i++) { window.__avisarCambio('productos'); await new Promise((r) => setTimeout(r, 6)); } });
    await new Promise((r) => setTimeout(r, 2500));
    console.log(`    500 avisos → ${consultasMenu} consultas al servidor`);
    assert.ok(consultasMenu <= 4, `demasiadas consultas: ${consultasMenu}`);
    assert.ok(consultasMenu >= 2, 'la inundación no puede congelar las actualizaciones');
    assert.deepEqual(errores, []);
    await page.close();
  });
});

// ---------------------------------------------------------------- robustez
describe('datos dañados guardados en el navegador del cliente', () => {
  const VENENOS = [
    ['carrito que no es JSON', { qb_carrito_v1: 'esto no es json {' }],
    ['carrito con cantidades absurdas', { qb_carrito_v1: JSON.stringify({ 'classic-burger': 1e9, 'smash-burger': -5, 'combo-x4': 'muchos', 'mini-burger': 2.5 }) }],
    ['carrito con productos inexistentes y opciones rotas', { qb_carrito_v1: JSON.stringify({ 'no-existe': 2, 'combo-melo~[[': 1, 'classic-burger~"hola"': 1, 'combo-melo~[["x","y","z"]]': 1, 'jugo-lulo~[["En chocolate"]]': 3 }) }],
    ['carrito contaminado (__proto__)', { qb_carrito_v1: '{"__proto__":{"admin":true},"constructor":{"prototype":{"x":1}}}' }],
    ['carrito gigante (3 MB)', { qb_carrito_v1: JSON.stringify(Object.fromEntries(Array.from({ length: 60000 }, (_, i) => [`p${i}-${'x'.repeat(30)}`, 1]))) }],
    ['menú guardado con forma rara', { qb_menu_v1: JSON.stringify({ t: Date.now(), datos: { categorias: 'x', productos: [null, 7, { id: 1 }], destacado: 5 } }) }],
    ['menú guardado null', { qb_menu_v1: 'null' }],
    ['datos del cliente dañados', { qb_cliente_v1: JSON.stringify({ nombre: { a: 1 }, pago: ['x'], entrega: 42 }) }],
  ];
  for (const [nombre, datos] of VENENOS) {
    test(`${nombre}: la web abre, muestra el menú y deja pedir`, async () => {
      const { page, errores } = await abrir({ preparar: new Function(`try { ${Object.entries(datos).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)});`).join('')} } catch (e) {}`) });
      await abrirCat(page, 'hamburguesas');
      await page.click('[data-action-for="classic-burger"] [data-inc], [data-action-for="classic-burger"] .add-btn');
      const total = await page.$eval('[data-cart-total]', (e) => e.textContent);
      assert.match(total, /^\$[\d.]+$/, `total legible: ${total}`);
      assert.doesNotMatch(total, /NaN|undefined|Infinity/);
      assert.deepEqual(errores, []);
      await page.close();
    });
  }

  test('modo privado / navegador sin almacenamiento (localStorage lanza error): todo funciona', async () => {
    const { page, errores } = await abrir({ preparar: () => {
      const falla = () => { throw new DOMException('QuotaExceededError'); };
      Storage.prototype.setItem = falla; Storage.prototype.getItem = falla;
    } });
    await abrirCat(page, 'hamburguesas');
    await page.click('[data-action-for="classic-burger"] [data-inc]');
    assert.equal(await page.$eval('[data-cart-count]', (e) => e.textContent), '1');
    assert.deepEqual(errores, []);
    await page.close();
  });
});

describe('servidor caído o respondiendo basura', () => {
  for (const m of ['caido', 'html500', 'basura', 'vacio', 'raro', 'lento']) {
    test(`Supabase "${m}": la web carga el menú de respaldo y el pedido sale por WhatsApp`, async () => {
      modo = m;
      try {
        const { page, errores } = await abrir();
        assert.ok(await page.$$eval('.dish', (x) => x.length) > 50, 'menú de respaldo visible');
        await abrirCat(page, 'hamburguesas');
        await page.click('[data-action-for="classic-burger"] [data-inc]');
        await page.click('.cart-btn');
        await page.waitForSelector('[name=nombre]', { visible: true });
        await page.$eval('[name=nombre]', (el) => { el.value = 'Ana'; });
        await page.$eval('[name=direccion]', (el) => { el.value = 'Calle 1'; });
        await page.click('[data-enviar]');
        await page.waitForFunction(() => window.__whatsapp.some((u) => u.startsWith('https://wa.me/')), { timeout: 15000 });
        assert.deepEqual(errores, [], 'sin errores de JavaScript');
        await page.close();
      } finally { modo = 'normal'; }
    });
  }
});

// ---------------------------------------------------------------- rendimiento
describe('carga extrema', () => {
  test('menú gigante (1.500 productos): carga, busca y abre categorías rápido', async () => {
    const [{ id: cat }] = await ctx.admin(`select id from public.categorias where slug = 'hamburguesas'`);
    await ctx.base.db.exec(`insert into public.productos (slug, categoria_id, nombre, descripcion, precio, orden)
      select 'gigante-' || i, '${cat}', 'Gigante ' || i, 'Descripción larga ' || repeat('sabor ', 20), 1000 + i, 100 + i from generate_series(1, 1500) i`);
    const t0 = Date.now();
    const { page, errores } = await abrir();
    await page.waitForFunction(() => document.querySelectorAll('.dish').length > 1500, { timeout: 20000 });
    const carga = Date.now() - t0;
    const t1 = Date.now();
    await page.type('[data-search]', 'gigante 149');
    await page.waitForFunction(() => /resultado/.test(document.querySelector('[data-menu-count]').textContent), { timeout: 5000 });
    const busqueda = Date.now() - t1;
    console.log(`    menú de ${await page.$$eval('.dish', (x) => x.length)} platos: carga ${carga} ms · búsqueda ${busqueda} ms`);
    assert.ok(carga < 8000, `carga ${carga} ms`);
    assert.ok(busqueda < 2500, `búsqueda ${busqueda} ms`);
    assert.deepEqual(errores, []);
    await ctx.admin(`update public.productos set activo = false where slug like 'gigante-%'`);
    await page.close();
  });

  test('sin fugas de memoria: 300 veces abrir/cerrar la ventanita y 150 cambios en vivo del menú', async () => {
    const { page, errores } = await abrir();
    const cdp = await page.createCDPSession();
    const memoria = async () => { await cdp.send('HeapProfiler.collectGarbage'); return (await page.metrics()).JSHeapUsedSize; };
    const nodos = () => page.evaluate(() => document.getElementsByTagName('*').length);
    await abrirCat(page, 'combitos');
    const m0 = await memoria(); const n0 = await nodos();
    for (let i = 0; i < 300; i++) {
      await page.evaluate(() => { document.querySelector('[data-elegir="combo-melo"]').click(); document.querySelector('[data-opciones]').close(); });
    }
    for (let i = 0; i < 150; i++) await page.evaluate(() => window.__avisarCambio('productos'));
    await new Promise((r) => setTimeout(r, 1500));
    const m1 = await memoria(); const n1 = await nodos();
    console.log(`    memoria ${(m0 / 1e6).toFixed(1)} → ${(m1 / 1e6).toFixed(1)} MB · nodos ${n0} → ${n1}`);
    assert.ok(m1 - m0 < 15e6, `creció ${(m1 - m0) / 1e6} MB`);
    assert.ok(n1 < n0 * 1.2, `nodos ${n0} → ${n1}`);
    assert.deepEqual(errores, []);
    await page.close();
  });

  test('clientes desesperados: 10 clics seguidos en "Pedir por WhatsApp" crean UN solo pedido', async () => {
    const [{ n: antes }] = await ctx.admin(`select count(*)::int n from public.pedidos`);
    const { page } = await abrir();
    await abrirCat(page, 'hamburguesas');
    await page.click('[data-action-for="classic-burger"] [data-inc]');
    await page.click('.cart-btn');
    await page.waitForSelector('[name=nombre]', { visible: true });
    await page.$eval('[name=nombre]', (el) => { el.value = 'Impaciente'; });
    await page.$eval('[name=direccion]', (el) => { el.value = 'Calle 1'; });
    await page.evaluate(() => { for (let i = 0; i < 10; i++) document.querySelector('[data-enviar]').click(); });
    await page.waitForFunction(() => window.__whatsapp.some((u) => u.startsWith('https://wa.me/')), { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1500));
    const [{ n: despues }] = await ctx.admin(`select count(*)::int n from public.pedidos`);
    assert.equal(despues - antes, 1);
    await page.close();
  });

  test('pedido enorme (40 platos distintos × 99): total exacto o mensaje claro, nunca un número roto', async () => {
    const { page, errores } = await abrir();
    const slugs = await page.evaluate(() => [...document.querySelectorAll('[data-action-for] [data-inc]')].map((b) => b.dataset.inc).filter((s) => !s.includes('~')).slice(0, 45));
    await page.evaluate((ss) => localStorage.setItem('qb_carrito_v1', JSON.stringify(Object.fromEntries(ss.map((s) => [s, 99])))), slugs);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.dish');
    const total = await page.$eval('[data-cart-total]', (e) => e.textContent);
    assert.match(total, /^\$[\d.]+$/);
    await page.click('.cart-btn');
    await page.waitForSelector('[name=nombre]', { visible: true });
    await page.$eval('[name=nombre]', (el) => { el.value = 'Fiesta'; });
    await page.$eval('[name=direccion]', (el) => { el.value = 'Calle 1'; });
    await page.click('[data-enviar]');
    await new Promise((r) => setTimeout(r, 2500));
    const toast = await page.$eval('[data-toast]', (e) => e.textContent);
    console.log(`    respuesta a 45 platos × 99: "${toast.trim()}"`);
    assert.doesNotMatch(toast, /error interno|undefined|NaN|violates|constraint/i);
    assert.deepEqual(errores, []);
    await page.close();
  });
});

// ---------------------------------------------------------------- portabilidad y usabilidad
describe('pantallas, navegadores y accesibilidad', () => {
  for (const [ancho, alto, movil] of [[320, 568, true], [360, 740, true], [768, 1024, true], [1024, 600, false], [1920, 1080, false], [2560, 1440, false]]) {
    test(`${ancho}×${alto}: sin desbordes horizontales y botones del tamaño de un dedo`, async () => {
      const { page, errores } = await abrir({ ancho, alto, movil });
      await abrirCat(page, 'hamburguesas');
      const r = await page.evaluate(() => {
        const visibles = [...document.querySelectorAll('.add-btn, .cart-btn, .hero-ctas .btn, .stepper button')].filter((b) => b.offsetParent);
        return {
          desborde: document.documentElement.scrollWidth - window.innerWidth,
          pequenos: visibles.filter((b) => { const r = b.getBoundingClientRect(); return r.width < 32 || r.height < 32; }).map((b) => b.className),
        };
      });
      assert.ok(r.desborde <= 1, `desborde horizontal de ${r.desborde}px`);
      assert.deepEqual(r.pequenos, []);
      assert.deepEqual(errores, []);
      await page.close();
    });
  }

  test('texto al 200 % (personas con baja visión): sigue sin desbordes', async () => {
    const { page } = await abrir({ ancho: 390, alto: 844, movil: true, preparar: () => document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '200%'; }) });
    const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(desborde <= 1, `desborde ${desborde}px`);
    await page.close();
  });

  test('Microsoft Edge: el flujo completo funciona igual', { skip: !EDGE && 'Edge no está instalado' }, async () => {
    const edge = await puppeteer.launch({ executablePath: EDGE, headless: true });
    try {
      const { page, errores } = await abrir({ nav: edge });
      await abrirCat(page, 'combitos');
      await page.click('[data-elegir="combo-melo"]');
      await page.waitForSelector('[data-opciones][open]');
      await page.select('select[name="g0-0"]', 'Coca-Cola');
      await page.select('select[name="g0-1"]', 'Pepsi');
      await page.click('[data-opc-agregar]');
      assert.equal(await page.$eval('[data-cart-total]', (e) => e.textContent), '$45.000');
      assert.deepEqual(errores, []);
      await page.close();
    } finally { await edge.close(); }
  });

  test('sin JavaScript: se ve el aviso para pedir por WhatsApp', async () => {
    const contexto = await navegador.createBrowserContext();
    const page = await contexto.newPage();
    await page.setJavaScriptEnabled(false);
    await page.goto(`http://127.0.0.1:${puerto}/`, { waitUntil: 'domcontentloaded' });
    assert.match(await page.content(), /Activa JavaScript/);
    await contexto.close();
  });

  test('solo con teclado: abrir opciones, elegir, agregar y cerrar con Escape', async () => {
    const { page } = await abrir();
    await abrirCat(page, 'jugos');
    await page.focus('[data-elegir="jugo-lulo"]');
    await page.keyboard.press('Enter');
    await page.waitForSelector('[data-opciones][open]');
    const dentro = await page.evaluate(() => document.querySelector('[data-opciones]').contains(document.activeElement));
    assert.ok(dentro, 'el foco entra a la ventanita');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('[data-opciones]').open, { timeout: 3000 });
    await page.focus('[data-elegir="jugo-lulo"]');
    await page.keyboard.press('Enter');
    await page.waitForSelector('[data-opciones][open]');
    await page.focus('[data-opc-agregar]');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('[data-cart-count]').textContent === '1', { timeout: 3000 });
    await page.close();
  });

  test('accesibilidad básica: idioma, títulos, imágenes con texto alternativo, botones y campos con nombre', async () => {
    const { page } = await abrir();
    await abrirCat(page, 'hamburguesas');
    await page.click('.cart-btn');
    const r = await page.evaluate(() => {
      const nombre = (el) => (el.getAttribute('aria-label') || el.textContent || el.title || el.querySelector('img')?.alt || '').trim();
      const etiqueta = (el) => el.labels?.length || el.getAttribute('aria-label') || el.closest('label');
      return {
        lang: document.documentElement.lang,
        h1: document.querySelectorAll('h1').length,
        sinAlt: [...document.images].filter((i) => !i.hasAttribute('alt')).map((i) => i.src.slice(-40)),
        botonesSinNombre: [...document.querySelectorAll('button, a[href]')].filter((b) => b.offsetParent && !nombre(b)).map((b) => b.outerHTML.slice(0, 80)),
        camposSinEtiqueta: [...document.querySelectorAll('input:not([type=hidden]), select, textarea')].filter((c) => c.offsetParent && !etiqueta(c)).map((c) => c.name || c.outerHTML.slice(0, 60)),
      };
    });
    assert.match(r.lang, /^es/);
    assert.deepEqual({ ...r, lang: 'es' }, { lang: 'es', h1: 1, sinAlt: [], botonesSinNombre: [], camposSinEtiqueta: [] });
    await page.close();
  });
});
