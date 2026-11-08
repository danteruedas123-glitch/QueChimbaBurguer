/**
 * Pruebas de INTEGRACIÓN de la página web con la base de datos.
 * La web real se sirve localmente y sus llamadas a Supabase se responden
 * ejecutando LAS MISMAS funciones SQL en PostgreSQL (PGlite).
 *   Carpeta de la web: QB_WEB_DIR (por defecto ../WebQuechimbaburger)
 *   Navegador: CHROME_PATH (por defecto Chrome o Edge instalados)
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { buscarChoques } from './choques.js';
import { nuevaBase } from '../helpers/bd.js';
import { FESTIVIDADES } from '../../src/shared/festividades.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const WEB = process.env.QB_WEB_DIR ?? path.resolve(RAIZ, '..', 'WebQuechimbaburger');
const NAVEGADOR = process.env.CHROME_PATH ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((r) => existsSync(r));
const SB_URL = 'https://prueba.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.firma';
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };

let servidor;
let puerto;
let navegador;
let ctx;                       // base de datos con actores (web/staff)
let modoSupabase = 'normal';   // normal | caido | lento
const peticiones = [];

/** Servidor estático; inyecta la conexión de Supabase en config.js si se pide ?sb=1 */
function servir() {
  return new Promise((ok) => {
    servidor = http.createServer(async (req, res) => {
      const url = new URL(req.url, 'http://x');
      const ruta = path.join(WEB, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
      if (!ruta.startsWith(WEB)) { res.writeHead(403).end(); return; }
      try {
        let cuerpo = await readFile(ruta);
        if (url.pathname === '/js/config.js') {
          // Nunca se usa el Supabase real en las pruebas: se apunta al simulado o se desactiva
          const conSb = req.headers.referer?.includes('sb=1');
          cuerpo = cuerpo.toString()
            .replace(/url: '[^']*'/, `url: '${conSb ? SB_URL : ''}'`)
            .replace(/anonKey: '[^']*'/, `anonKey: '${conSb ? SB_KEY : ''}'`);
        }
        res.writeHead(200, { 'Content-Type': TIPOS[path.extname(ruta)] ?? 'application/octet-stream' }).end(cuerpo);
      } catch {
        res.writeHead(404).end();
      }
    }).listen(0, '127.0.0.1', () => { puerto = servidor.address().port; ok(); });
  });
}

/** Abre la web. Las llamadas a Supabase se resuelven contra PostgreSQL real. */
async function abrir({ conSupabase = true, preparar } = {}) {
  // Perfil limpio por prueba (como incógnito): sin carrito ni menú guardados de otras pruebas
  const contexto = await navegador.createBrowserContext();
  const page = await contexto.newPage();
  page.close = () => contexto.close();
  await page.setViewport({ width: 1280, height: 900 });
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.evaluateOnNewDocument(() => {
    // Realtime simulado: registra lo que la web envía y permite emitir avisos
    window.__ws = { enviados: [], conexiones: [] };
    window.WebSocket = class {
      constructor(url) {
        this.url = url;
        this.readyState = 0;
        window.__ws.conexiones.push(this);
        setTimeout(() => { this.readyState = 1; this.onopen?.(); }, 10);
      }
      send(d) { window.__ws.enviados.push(JSON.parse(d)); }
      close() { this.readyState = 3; }
    };
    window.__avisarCambio = (tabla) => window.__ws.conexiones.forEach((c) => c.onmessage?.({
      data: JSON.stringify({ topic: 'realtime:menu-publico', event: 'broadcast', payload: { event: 'menu-cambio', payload: { tabla } } }),
    }));
    // Captura las URL de WhatsApp en lugar de abrir pestañas reales
    window.__whatsapp = [];
    window.open = (u) => {
      if (u) window.__whatsapp.push(u);
      return { opener: {}, close() { this.cerrada = true; }, location: { set href(v) { window.__whatsapp.push(v); } } };
    };
  });
  if (preparar) await page.evaluateOnNewDocument(preparar);
  await page.setRequestInterception(true);
  page.on('request', async (req) => {
    const url = req.url();
    if (req.method() === 'OPTIONS') {
      return req.respond({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'apikey, authorization, content-type', 'Access-Control-Allow-Methods': 'POST' } });
    }
    if (url.startsWith(SB_URL)) {
      const fn = url.split('/rpc/')[1];
      const cuerpo = JSON.parse(req.postData() || '{}');
      peticiones.push({ fn, cuerpo, apikey: req.headers().apikey });
      if (modoSupabase === 'caido') return req.abort('connectionrefused');
      if (modoSupabase === 'lento') await new Promise((r) => setTimeout(r, 3000));
      try {
        const datos = await ctx.base.rpc(fn, cuerpo, { rol: 'anon' });
        return req.respond({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(datos) });
      } catch (e) {
        return req.respond({ status: 400, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ message: e.message, hint: e.hint, code: e.code }) });
      }
    }
    if (!url.startsWith(`http://127.0.0.1:${puerto}`)) return req.abort(); // sin internet: pruebas deterministas
    return req.continue();
  });
  await page.goto(`http://127.0.0.1:${puerto}/?${conSupabase ? 'sb=1' : 'sb=0'}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.cat');
  // Con Supabase disponible, esperar a que el menú real quede aplicado antes de interactuar
  if (conSupabase && modoSupabase === 'normal') {
    await page.waitForFunction(() => localStorage.getItem('qb_menu_v1'), { timeout: 10000, polling: 50 });
  }
  return { page, errores };
}

async function abrirCategoria(page, slug) {
  await page.$eval(`.cat[data-grupo="${slug}"]`, (d) => { d.open = true; });
  // Esperar a que la categoría termine de desplegarse (si no, el clic cae donde estaba el botón)
  await page.waitForFunction((s) => document.querySelector(`.cat[data-grupo="${s}"]`).getAnimations({ subtree: true })
    .every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity), { timeout: 5000, polling: 50 }, slug);
}

async function pedir(page, productos, { nombre = 'Cliente Prueba', direccion = 'Calle 1 # 2-3', pago = 'Nequi' } = {}) {
  for (const [slug, n] of productos) {
    const cat = await page.$eval(`.dish[data-id="${slug}"]`, (d) => d.closest('.cat').dataset.grupo);
    await abrirCategoria(page, cat);
    for (let i = 0; i < n; i++) await page.click(`[data-action-for="${slug}"] [data-inc]`);
  }
  await page.click('.cart-btn');
  await page.waitForSelector('[name=nombre]', { visible: true });
  // Esperar a que el panel termine de deslizarse (una persona no hace clic durante la animación)
  await page.waitForFunction(() => {
    const d = document.querySelector('[data-drawer]');
    return d.open && d.getAnimations({ subtree: true }).every((a) => a.playState !== 'running');
  }, { timeout: 5000, polling: 50 });
  await page.$eval('[name=nombre]', (el, v) => { el.value = v; }, nombre);
  await page.$eval('[name=direccion]', (el, v) => { el.value = v; }, direccion);
  await page.select('[name=pago]', pago);
  await page.click('[data-enviar]');
}

const ultimoPedido = async () => (await ctx.admin(`select * from public.pedidos order by numero desc limit 1`))[0];
const esperarWhatsApp = (page) => page.waitForFunction(() => window.__whatsapp.some((u) => u.startsWith('https://wa.me/')), { timeout: 10000, polling: 100 })
  .then(() => page.evaluate(() => decodeURIComponent(window.__whatsapp.find((u) => u.startsWith('https://wa.me/')).split('text=')[1])));

before(async () => {
  assert.ok(NAVEGADOR, 'No se encontró Chrome ni Edge (define CHROME_PATH)');
  assert.ok(existsSync(path.join(WEB, 'index.html')), `No se encontró la web en ${WEB}`);
  ctx = await nuevaBase();
  await servir();
  navegador = await puppeteer.launch({ executablePath: NAVEGADOR, headless: true });
});
after(async () => {
  await navegador?.close();
  servidor?.close();
  await ctx?.base.cerrar();
});

describe('menú administrado desde la base de datos', () => {
  test('la web muestra precios y platos tal como están en la base de datos', async () => {
    const [q] = await ctx.admin(`select id, categoria_id from public.productos where slug = 'quechimba'`);
    await ctx.staff('producto_guardar', { p: { id: q.id, categoria_id: q.categoria_id, nombre: 'La Quechimba', precio: 31500, etiqueta: 'Más pedida', foto_url: 'assets/img/quechimba.webp' } });
    await ctx.staff('producto_guardar', { p: { categoria_id: q.categoria_id, nombre: 'Hamburguesa de la Prueba', precio: 21000 } });
    const { page, errores } = await abrir();
    await page.waitForFunction(() => document.querySelector('.dish[data-id="hamburguesa-de-la-prueba"]'), { timeout: 10000, polling: 100 });
    assert.equal(await page.$eval('.dish[data-id="quechimba"] .dish-price', (e) => e.textContent), '$31.500');
    assert.deepEqual(await page.$eval('[data-hero-ticket]', (t) => [t.hidden, t.querySelector('[data-hero-nombre]').textContent, t.querySelector('[data-hero-precio]').textContent]),
      [false, 'Salchipapa De Nivel', '$40.000'], 'la portada muestra el producto destacado con su precio de la base de datos');
    assert.deepEqual(errores, []);
    await page.close();
  });

  test('los agotados se ven marcados y no se pueden agregar', async () => {
    const [p] = await ctx.admin(`select id, categoria_id, nombre, precio from public.productos where slug = 'aros-cebolla'`);
    await ctx.staff('producto_guardar', { p: { ...p, agotado: true } });
    const { page } = await abrir();
    await page.waitForFunction(() => document.querySelector('[data-action-for="aros-cebolla"] .soldout'), { timeout: 10000, polling: 100 });
    assert.equal(await page.$('[data-action-for="aros-cebolla"] [data-inc]'), null);
    await ctx.staff('producto_guardar', { p: { ...p, agotado: false } });
    await page.close();
  });

  test('si un producto del carrito se agota, se quita del carrito con un aviso', async () => {
    const [p] = await ctx.admin(`select id, categoria_id, nombre, precio from public.productos where slug = 'perro-ranchero'`);
    await ctx.staff('producto_guardar', { p: { ...p, agotado: true } });
    const { page } = await abrir({ preparar: () => localStorage.setItem('qb_carrito_v1', JSON.stringify({ 'perro-ranchero': 2, clasica: 1 })) });
    await page.waitForFunction(() => !JSON.parse(localStorage.getItem('qb_carrito_v1'))['perro-ranchero'], { timeout: 10000, polling: 100 });
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('qb_carrito_v1'))), { clasica: 1 });
    await ctx.staff('producto_guardar', { p: { ...p, agotado: false } });
    await page.close();
  });
});

describe('pedidos desde la web', () => {
  test('el pedido queda registrado y WhatsApp lleva su número y valores del servidor', async () => {
    peticiones.length = 0;
    const { page, errores } = await abrir();
    await pedir(page, [['clasica', 2], ['limonada', 1]]);
    const mensaje = await esperarWhatsApp(page);
    const p = await ultimoPedido();
    assert.equal(p.canal, 'web');
    assert.equal(p.estado, 'nuevo');
    assert.equal(p.total, 18000 * 2 + 7000);
    assert.equal(p.cliente_nombre, 'Cliente Prueba');
    assert.equal(p.metodo_pago, 'nequi');
    assert.match(mensaje, new RegExp(`\\*Pedido #${String(p.numero).padStart(4, '0')}\\*`));
    assert.match(mensaje, /2 x La Clásica — \$36\.000/);
    assert.match(mensaje, /\*Subtotal:\* \$43\.000 \+ domicilio/);
    // La web solo envía identificadores y cantidades, nunca precios
    const envio = peticiones.find((x) => x.fn === 'crear_pedido_web').cuerpo;
    assert.deepEqual(envio.p_items, [{ slug: 'clasica', cantidad: 2 }, { slug: 'limonada', cantidad: 1 }]);
    assert.ok(!JSON.stringify(envio).includes('precio'));
    assert.deepEqual(errores, []);
    await page.close();
  });

  test('un menú manipulado en el navegador no altera lo que se cobra', async () => {
    // Un "cliente listo" cambia los precios guardados en su navegador a $1
    modoSupabase = 'lento'; // el menú real tarda: el pedido se hace con el precio falso en pantalla
    const { page } = await abrir({
      preparar: () => localStorage.setItem('qb_menu_v1', JSON.stringify({ t: Date.now(), datos: {
        categorias: [{ id: 'hamburguesas', nombre: 'Hamburguesas' }],
        productos: [{ id: 'clasica', categoria: 'hamburguesas', nombre: 'La Clásica', descripcion: '', precio: 1, foto: 'assets/img/logo.webp', agotado: false }],
        destacado: null, pedidosWebActivos: true,
      } })),
    });
    assert.equal(await page.$eval('.dish[data-id="clasica"] .dish-price', (e) => e.textContent), '$1', 'en pantalla está el precio manipulado');
    await pedir(page, [['clasica', 3]]);
    modoSupabase = 'normal';
    await esperarWhatsApp(page);
    const p = await ultimoPedido();
    assert.equal(p.total, 18000 * 3, 'se cobra el precio real de la base de datos');
    await page.close();
  });

  test('si Supabase está caído, la web sigue funcionando y el pedido sale por WhatsApp', async () => {
    modoSupabase = 'caido';
    const antes = (await ultimoPedido()).numero;
    let page, errores, mensaje;
    try {
      ({ page, errores } = await abrir());
      await pedir(page, [['classic-burger', 1]]); // menú de respaldo (config.js)
      mensaje = await esperarWhatsApp(page);
    } finally {
      modoSupabase = 'normal'; // pase lo que pase, las demás pruebas siguen con la base disponible
    }
    assert.doesNotMatch(mensaje, /Pedido #/, 'sin registro no hay número');
    assert.match(mensaje, /1 x Classic Burger/);
    assert.equal((await ultimoPedido()).numero, antes, 'no se creó nada en la base de datos');
    assert.deepEqual(errores, []);
    await page.close();
  });

  test('con la web desactivada (local cerrado) no hay ninguna forma de pedir: ni página ni WhatsApp', async () => {
    await ctx.staff('ajustes_guardar', { p: { pedidos_web_activos: false } });
    const { page } = await abrir({ preparar: () => localStorage.setItem('qb_carrito_v1', JSON.stringify({ clasica: 1 })) });
    await page.waitForFunction(() => !document.querySelector('[data-aviso-cerrado]').hidden, { timeout: 10000, polling: 100 });
    assert.match(await page.$eval('[data-aviso-cerrado]', (e) => e.textContent), /cerrados/);
    const visibles = await page.evaluate(() => {
      const seVe = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
      return {
        whatsapp: [...document.querySelectorAll('a[href*="wa.me"]')].filter(seVe).length,
        agregar: [...document.querySelectorAll('[data-inc]')].filter(seVe).length,
        carrito: [...document.querySelectorAll('.cart-btn, .cart-bar, .wa-float')].filter(seVe).length,
      };
    });
    assert.deepEqual(visibles, { whatsapp: 0, agregar: 0, carrito: 0 });
    assert.ok(await page.$$eval('.dish', (x) => x.length) > 0, 'el menú se sigue pudiendo ver');
    assert.equal(await page.$eval('[data-enviar]', (b) => b.disabled), true);
    await ctx.staff('ajustes_guardar', { p: { pedidos_web_activos: true } });
    await page.close();
  });

  test('si un producto se agota justo al enviar, se informa y no se registra ni se envía', async () => {
    const { page } = await abrir();
    const antes = (await ultimoPedido()).numero;
    const [p] = await ctx.admin(`select id, categoria_id, nombre, precio from public.productos where slug = 'jugo-mango'`);
    await abrirCategoria(page, 'bebidas');
    await page.click('[data-action-for="jugo-mango"] [data-inc]');
    await ctx.staff('producto_guardar', { p: { ...p, agotado: true } }); // se agota mientras el cliente decide
    await pedir(page, []);
    // Aviso: "no está disponible" y, al recargar el menú, "Se quitó de tu pedido (agotado)"
    await page.waitForFunction(() => /no está disponible|agotado/.test(document.querySelector('[data-toast]').textContent), { timeout: 10000, polling: 100 });
    await page.waitForFunction(() => !JSON.parse(localStorage.getItem('qb_carrito_v1') || '{}')['jugo-mango'], { timeout: 10000, polling: 100 });
    assert.equal(await page.evaluate(() => window.__whatsapp.filter((u) => u.startsWith('https://wa.me/')).length), 0);
    assert.equal((await ultimoPedido()).numero, antes);
    await ctx.staff('producto_guardar', { p: { ...p, agotado: false } });
    await page.close();
  });
});

describe('web en vivo (sin recargar la pestaña)', () => {
  test('se conecta al canal público "menu-publico" con la llave pública', async () => {
    const { page } = await abrir();
    await page.waitForFunction(() => window.__ws.enviados.some((m) => m.event === 'phx_join'), { timeout: 5000, polling: 50 });
    const r = await page.evaluate(() => ({ url: window.__ws.conexiones[0].url, join: window.__ws.enviados.find((m) => m.event === 'phx_join') }));
    assert.match(r.url, /^wss:\/\/prueba\.supabase\.co\/realtime\/v1\/websocket\?apikey=/);
    assert.equal(r.join.topic, 'realtime:menu-publico');
    assert.equal(r.join.payload.config.private, false);
    await page.close();
  });

  test('un cambio de precio en la app aparece en la web al instante, sin recargar', async () => {
    const { page } = await abrir();
    await page.evaluate(() => { window.__mismaPagina = true; });
    const p = (await ctx.admin(`select id, categoria_id, nombre, precio from public.productos where slug = 'clasica'`))[0];
    await ctx.staff('producto_guardar', { p: { ...p, precio: 23456 } });
    const t0 = Date.now();
    await page.evaluate(() => window.__avisarCambio('productos'));
    await page.waitForFunction(() => document.querySelector('.dish[data-id="clasica"] .dish-price').textContent === '$23.456', { timeout: 5000, polling: 50 });
    assert.ok(Date.now() - t0 < 3000, 'debe verse en menos de 3 s');
    assert.equal(await page.evaluate(() => window.__mismaPagina), true, 'no se recargó la pestaña');
    await ctx.staff('producto_guardar', { p });
    await page.close();
  });

  test('desactivar la web desde la app muestra "cerrado" al instante en la pestaña abierta', async () => {
    const { page } = await abrir();
    await ctx.staff('ajustes_guardar', { p: { pedidos_web_activos: false } });
    await page.evaluate(() => window.__avisarCambio('ajustes'));
    await page.waitForFunction(() => !document.querySelector('[data-aviso-cerrado]').hidden, { timeout: 5000, polling: 50 });
    await ctx.staff('ajustes_guardar', { p: { pedidos_web_activos: true } });
    await page.evaluate(() => window.__avisarCambio('ajustes'));
    await page.waitForFunction(() => document.querySelector('[data-aviso-cerrado]').hidden, { timeout: 5000, polling: 50 });
    await page.close();
  });

  test('cambiar el producto destacado en la app cambia la portada: foto, nombre y precio', async () => {
    const { page } = await abrir();
    assert.match(await page.$eval('[data-hero-img]', (i) => i.getAttribute('src')), /promo-salchipapa/);
    const [combo] = await ctx.admin(`select id from public.productos where slug = 'combo-x4'`);
    const [original] = await ctx.admin(`select producto_destacado_id, foto_destacado_url from public.ajustes`);
    await ctx.staff('ajustes_guardar', { p: { producto_destacado_id: combo.id } });
    await page.evaluate(() => window.__avisarCambio('ajustes'));
    await page.waitForFunction(() => document.querySelector('[data-hero-nombre]').textContent === 'Combo x4', { timeout: 5000, polling: 50 });
    const src = await page.$eval('[data-hero-img]', (i) => i.getAttribute('src'));
    assert.match(src, /photo-1610614819513/, 'la foto es la del Combo x4');
    assert.equal(await page.$eval('[data-hero-precio]', (e) => e.textContent), '$85.000');
    // Tocar la portada agrega ese producto al pedido
    await page.click('[data-hero-ticket]');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('qb_carrito_v1'))?.['combo-x4'] === 1, { timeout: 5000, polling: 50 });
    // Sin destacado, vuelve la foto original y no hay ticket
    await ctx.staff('ajustes_guardar', { p: { producto_destacado_id: null } });
    await page.evaluate(() => window.__avisarCambio('ajustes'));
    await page.waitForFunction(() => document.querySelector('[data-hero-ticket]').hidden, { timeout: 5000, polling: 50 });
    assert.match(await page.$eval('[data-hero-img]', (i) => i.getAttribute('src')), /hero-quechimba/);
    await ctx.admin(`update public.ajustes set producto_destacado_id = $1, foto_destacado_url = $2`, [original.producto_destacado_id, original.foto_destacado_url]);
    await page.close();
  });
});

describe('festividades', () => {
  test('la web normal y los 30 diseños tienen contraste suficiente para leerse bien (WCAG AA)', async () => {
    const { page } = await abrir();
    const fallos = await page.evaluate(() => {
      const aRgb = (c) => { const el = document.createElement('i'); el.style.color = c; document.body.append(el); const v = getComputedStyle(el).color.match(/[\d.]+/g).map(Number); el.remove(); return v; };
      const lum = ([r, g, b]) => [r, g, b].map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }).reduce((s, x, i) => s + x * [0.2126, 0.7152, 0.0722][i], 0);
      const contraste = (a, b) => { const [x, y] = [lum(aRgb(a)), lum(aRgb(b))].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
      const v = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
      const malos = [];
      const temas = [['normal', { variantes: [{}] }], ...Object.entries(window.QB_TEMAS)];
      for (const [tema, t] of temas) {
        t.variantes.forEach((_, i) => {
          window.QB_aplicarTema({ tema, variante: i + 1, numero: 3 });
          const pares = [
            ['texto oscuro sobre botones', '#1b1511', v('--mustard')],
            ['blanco sobre etiquetas', '#ffffff', v('--ketchup')],
            ['crema sobre franja destacada', v('--cream'), v('--promo-bg')],
            ['blanco sobre la cinta', '#ffffff', v('--cinta-bg')],
            ['acento sobre fondo oscuro', v('--mustard'), v('--char')],
            ['crema sobre fondo oscuro', v('--cream'), v('--char')],
            ['acento rojo sobre fondo claro', v('--ketchup'), v('--cream')],
          ];
          for (const [nombre, a, b] of pares) {
            const c = contraste(a, b);
            if (c < 4.5) malos.push(`${tema} diseño ${i + 1}: ${nombre} = ${c.toFixed(2)}`);
          }
        });
      }
      window.QB_aplicarTema({ tema: 'normal' });
      return malos;
    });
    assert.deepEqual(fallos, []);
    await page.close();
  });

  test('la web tiene diseño para cada festividad de la app (y 3 diseños en cada una)', async () => {
    const { page } = await abrir();
    const temas = await page.evaluate(() => Object.fromEntries(Object.entries(window.QB_TEMAS).map(([k, t]) => [k, t.variantes.length])));
    assert.deepEqual(['normal', ...Object.keys(temas)].sort(), FESTIVIDADES.map((f) => f.id).sort());
    assert.ok(Object.values(temas).every((n) => n === 3));
    await page.close();
  });

  test('cada festividad cambia cinta, sello, ícono, calcomanía, escena ilustrada y menú', async () => {
    const { page } = await abrir();
    const r = await page.evaluate(() => {
      window.QB_aplicarTema({ tema: 'halloween', variante: 1 });
      return {
        tema: document.documentElement.dataset.tema,
        cinta: document.querySelector('[data-cinta]').textContent,
        cintaVisible: !document.querySelector('[data-cinta]').hidden,
        sello: document.querySelector('[data-sello]').textContent,
        favicon: document.querySelector('[data-favicon]').href.startsWith('data:image/svg+xml,'),
        calcomania: document.querySelector('[data-sticker]').textContent,
        titulo: document.title.startsWith('🎃'),
        escena: document.querySelectorAll('.decoracion svg').length > 5,
        suelo: !!document.querySelector('.decoracion .capa-suelo svg'),
        figura: !document.querySelector('[data-figura]').hidden && !!document.querySelector('[data-figura] svg'),
        baba: !!document.querySelector('[data-titulo-extra] .titulo-gotas') && !!document.querySelector('[data-borde-menu] svg'),
        tituloMenu: document.querySelector('[data-titulo-menu]').textContent,
        patron: getComputedStyle(document.documentElement).getPropertyValue('--patron-menu').trim().startsWith('url('),
      };
    });
    assert.deepEqual(r, {
      tema: 'halloween', cinta: r.cinta, cintaVisible: true, sello: 'FELIZ HALLOWEEN ✦ DULCE O TRUCO ✦ ', favicon: true, calcomania: '🎃', titulo: true,
      escena: true, suelo: true, figura: true, baba: true, tituloMenu: '¿Qué se te antoja esta noche… de terror?', patron: true,
    });
    assert.match(r.cinta, /Halloween/);
    // Volver a normal deja la web como estaba
    const n = await page.evaluate(() => {
      window.QB_aplicarTema({ tema: 'normal' });
      return {
        tema: document.documentElement.dataset.tema ?? null,
        dibujos: document.querySelectorAll('.decoracion *, [data-figura] *, [data-titulo-extra] *, [data-borde-menu] *').length,
        figuraOculta: document.querySelector('[data-figura]').hidden,
        favicon: document.querySelector('[data-favicon]').getAttribute('href'),
        cinta: document.querySelector('[data-cinta]').hidden,
        tituloMenu: document.querySelector('[data-titulo-menu]').textContent,
        patron: getComputedStyle(document.documentElement).getPropertyValue('--patron-menu').trim(),
      };
    });
    assert.deepEqual(n, { tema: null, dibujos: 0, figuraOculta: true, favicon: 'assets/img/favicon-64.png', cinta: true, tituloMenu: '¿Qué se te antoja hoy?', patron: '' });
    await page.close();
  });

  test('los 30 diseños tienen escena completa, con nombres válidos y dibujos SVG sin errores', async () => {
    const { page, errores } = await abrir();
    const avisos = [];
    page.on('console', (m) => { if (m.type() === 'error' && /attribute|Expected/.test(m.text())) avisos.push(m.text()); });
    const malos = await page.evaluate(() => {
      const { catalogo } = window.QB_ESCENAS;
      const mal = [];
      for (const [tema, t] of Object.entries(window.QB_TEMAS)) {
        if (!t.saludo || !t.menu) mal.push(`${tema}: falta saludo o título del menú`);
        t.variantes.forEach((v, i) => {
          const id = `${tema} diseño ${i + 1}`;
          if (!catalogo.escenas.includes(v.escena)) mal.push(`${id}: escena "${v.escena}" no existe`);
          if (!catalogo.guirnaldas.includes(v.guirnalda)) mal.push(`${id}: guirnalda "${v.guirnalda}" no existe`);
          if (!catalogo.patrones.includes(v.patron)) mal.push(`${id}: patrón "${v.patron}" no existe`);
          if (!catalogo.ornamentos.includes(v.ornamento)) mal.push(`${id}: ornamento "${v.ornamento}" no existe`);
          window.QB_aplicarTema({ tema, variante: i + 1, numero: 7 });
          const d = document.querySelector('.decoracion');
          const g = d.querySelector('.capa-guirnalda');
          if (!g || (!g.querySelector('svg') && !getComputedStyle(g).backgroundImage.startsWith('url('))) mal.push(`${id}: sin guirnalda`);
          if (!d.querySelector('.capa-cielo')?.children.length) mal.push(`${id}: cielo vacío`);
          if (!d.querySelector('.capa-suelo')?.children.length) mal.push(`${id}: suelo vacío`);
        });
      }
      window.QB_aplicarTema({ tema: 'normal' });
      return mal;
    });
    await new Promise((r) => setTimeout(r, 200));
    assert.deepEqual(malos, []);
    assert.deepEqual(avisos, [], 'todos los dibujos SVG son válidos');
    assert.deepEqual(errores, []);
    await page.close();
  });

  test('nada tapa nada: los 30 diseños en celular, tableta, portátil y pantalla grande', async () => {
    const { page } = await abrir();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]); // todo en reposo
    await page.evaluate(() => document.querySelector('.cat')?.setAttribute('open', ''));
    const choques = [];
    for (const [ancho, alto, movil] of [[360, 740, true], [390, 844, true], [768, 1024, true], [1280, 860, false], [1920, 1080, false]]) {
      await page.setViewport({ width: ancho, height: alto, isMobile: movil, hasTouch: movil });
      (await page.evaluate(buscarChoques)).forEach((c) => choques.push(`${ancho}x${alto} · ${c}`));
    }
    assert.deepEqual(choques, []);
    await page.close();
  });

  test('al entrar en temporada sale la bienvenida una sola vez por visita y se quita sola', async () => {
    await ctx.staff('ajustes_guardar', { p: { tema: 'halloween', tema_variante: 3 } });
    // Se registra cada bienvenida en el instante en que aparece (dura 2,6 s y no hay que perderla)
    const preparar = () => {
      window.__bienvenidas = [];
      new MutationObserver((cambios) => cambios.forEach((c) => c.addedNodes.forEach((n) => {
        if (n.classList?.contains('bienvenida')) window.__bienvenidas.push(n.textContent.replace(/\s+/g, ' ').trim());
      }))).observe(document, { childList: true, subtree: true });
    };
    const { page } = await abrir({ preparar });
    try {
      await page.waitForFunction(() => window.__bienvenidas.length > 0, { timeout: 10000, polling: 50 });
      assert.match((await page.evaluate(() => window.__bienvenidas))[0], /Feliz Halloween/);
      await page.waitForFunction(() => !document.querySelector('.bienvenida'), { timeout: 10000, polling: 100 });
      const alcanzable = await page.evaluate(() => {
        const boton = document.querySelector('.hero-ctas .btn--primary');
        const b = boton.getBoundingClientRect();
        return boton.contains(document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2));
      });
      assert.ok(alcanzable, 'después de la bienvenida los botones se pueden usar');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.documentElement.dataset.tema === 'halloween', { timeout: 10000, polling: 50 });
      await new Promise((r) => setTimeout(r, 1500));
      assert.deepEqual(await page.evaluate(() => window.__bienvenidas), [], 'en la misma visita no se repite');
    } finally {
      await ctx.staff('ajustes_guardar', { p: { tema: 'normal' } });
      await page.close();
    }
  });

  test('el aniversario muestra el número correcto ("1 año", "5 años")', async () => {
    const { page } = await abrir();
    const textos = await page.evaluate(() => [1, 5].map((numero) => {
      window.QB_aplicarTema({ tema: 'aniversario', variante: 1, numero });
      return [document.querySelector('[data-cinta]').textContent, document.querySelector('[data-sello]').textContent, document.querySelector('[data-figura] text').textContent];
    }));
    assert.match(textos[0][0], /¡Cumplimos 1 año!/);
    assert.match(textos[1][0], /¡Cumplimos 5 años!/);
    assert.match(textos[1][1], /^5 AÑOS/);
    assert.deepEqual([textos[0][2], textos[1][2]], ['1', '5'], 'el pastel lleva el número del aniversario');
    await page.close();
  });

  test('elegir la festividad en la app cambia la web en vivo, con el aniversario calculado por la base de datos', async () => {
    const { page } = await abrir();
    await ctx.staff('ajustes_guardar', { p: { tema: 'navidad' } });
    await page.evaluate(() => window.__avisarCambio('ajustes'));
    await page.waitForFunction(() => document.documentElement.dataset.tema === 'navidad', { timeout: 5000, polling: 50 });
    await ctx.staff('ajustes_guardar', { p: { aniversario: { dia: 1, mes: 1, numero: 4 }, tema: 'aniversario' } });
    await page.evaluate(() => window.__avisarCambio('ajustes'));
    await page.waitForFunction(() => document.documentElement.dataset.tema === 'aniversario', { timeout: 5000, polling: 50 });
    assert.match(await page.$eval('[data-cinta]', (e) => e.textContent), /4 años/);
    await ctx.staff('ajustes_guardar', { p: { tema: 'normal', aniversario: null } });
    await page.evaluate(() => window.__avisarCambio('ajustes'));
    await page.waitForFunction(() => !document.documentElement.dataset.tema, { timeout: 5000, polling: 50 });
    await page.close();
  });

  test('la escena no tapa botones y se queda quieta si el usuario pide menos movimiento', async () => {
    const { page } = await abrir();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    const r = await page.evaluate(() => {
      window.QB_aplicarTema({ tema: 'navidad', variante: 1 });
      const boton = document.querySelector('.hero-ctas .btn--primary');
      const b = boton.getBoundingClientRect();
      const encima = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      const todo = [...document.querySelectorAll('.decoracion *, [data-figura], [data-figura] *, [data-titulo-extra] *, [data-menu-figura] *')];
      return {
        botonAlcanzable: boton.contains(encima),
        animados: todo.filter((e) => getComputedStyle(e).animationName !== 'none').length,
        voladores: [...document.querySelectorAll('.particula, .vuela, .sube, .vuelo-trineo')].filter((e) => getComputedStyle(e).display !== 'none').length,
        elementos: todo.length > 50,
      };
    });
    assert.deepEqual(r, { botonAlcanzable: true, animados: 0, voladores: 0, elementos: true });
    await page.close();
  });
});

describe('opciones al pedir (bebida del combo, en agua o en leche…)', () => {
  before(async () => {
    const [{ id: cat }] = await ctx.admin(`select id from public.categorias where slug = 'combos'`);
    await ctx.staff('producto_guardar', { p: {
      categoria_id: cat, nombre: 'Combo Opciones', precio: 20000, descripcion: 'Para probar la ventanita',
      opciones: [
        { titulo: 'Preparación', elige: 1, opciones: [{ nombre: 'En agua', extra: 0 }, { nombre: 'En leche', extra: 2000 }] },
        { titulo: 'Gaseosas', elige: 2, lista: 'gaseosas' },
      ],
    } });
  });

  test('se abre la ventanita, se elige, el precio se actualiza y el pedido llega con lo elegido', async () => {
    const { page, errores } = await abrir();
    await page.waitForSelector('[data-elegir="combo-opciones"]', { timeout: 10000 });
    await abrirCategoria(page, 'combos');
    assert.match(await page.$eval('.dish[data-id="combo-opciones"] .dish-price', (e) => e.textContent), /desde \$20\.000/);
    await page.click('[data-elegir="combo-opciones"]');
    await page.waitForSelector('[data-opciones][open]');
    const inicio = await page.evaluate(() => ({
      precio: document.querySelector('[data-opc-precio]').textContent,
      bloqueado: document.querySelector('[data-opc-agregar]').disabled,
      marcada: document.querySelector('input[name="g0"]:checked')?.value,
    }));
    assert.deepEqual(inicio, { precio: '$20.000', bloqueado: true, marcada: 'En agua' }, 'lo básico viene marcado; las gaseosas hay que elegirlas');
    await page.click('input[name="g0"][value="En leche"] + span');
    await page.select('select[name="g1-0"]', 'Coca-Cola');
    await page.select('select[name="g1-1"]', 'Pepsi');
    assert.deepEqual(await page.evaluate(() => [document.querySelector('[data-opc-precio]').textContent, document.querySelector('[data-opc-agregar]').disabled]), ['$22.000', false]);
    await page.click('[data-opc-agregar]');
    await page.waitForFunction(() => !document.querySelector('[data-opciones]').open, { timeout: 5000, polling: 50 });

    // Otro igual pero con otras gaseosas → línea aparte
    await page.click('[data-elegir="combo-opciones"]');
    await page.waitForSelector('[data-opciones][open]');
    await page.select('select[name="g1-0"]', 'Ginger');
    await page.select('select[name="g1-1"]', 'Ginger');
    await page.click('[data-opc-agregar]');
    await page.waitForFunction(() => !document.querySelector('[data-opciones]').open, { timeout: 5000, polling: 50 });
    assert.equal(await page.$eval('[data-elegir="combo-opciones"] .add-count', (e) => e.textContent), '2');

    await page.click('.cart-btn');
    await page.waitForSelector('[name=nombre]', { visible: true });
    const lineas = await page.$$eval('[data-cart-lines] .line', (ls) => ls.map((l) => l.querySelector('.line-det')?.textContent));
    assert.deepEqual(lineas, ['Preparación: En leche · Gaseosas: Coca-Cola, Pepsi', 'Preparación: En agua · Gaseosas: Ginger, Ginger']);
    assert.equal(await page.$eval('[data-cart-total]', (e) => e.textContent), '$42.000');
    await page.waitForFunction(() => {
      const d = document.querySelector('[data-drawer]');
      return d.open && d.getAnimations({ subtree: true }).every((a) => a.playState !== 'running');
    }, { timeout: 5000, polling: 50 });
    await page.$eval('[name=nombre]', (el) => { el.value = 'Cliente Opciones'; });
    await page.$eval('[name=direccion]', (el) => { el.value = 'Calle 1'; });
    await page.click('[data-enviar]');
    const mensaje = await esperarWhatsApp(page);
    assert.match(mensaje, /1 x Combo Opciones — \$22\.000\n   ↳ Preparación: En leche · Gaseosas: Coca-Cola, Pepsi/);
    const p = await ultimoPedido();
    const items = await ctx.admin(`select precio_unitario, cantidad, detalle from public.pedido_items where pedido_id = $1 order by detalle`, [p.id]);
    assert.deepEqual(items, [
      { precio_unitario: 22000, cantidad: 1, detalle: 'Preparación: En leche · Gaseosas: Coca-Cola, Pepsi' },
      { precio_unitario: 20000, cantidad: 1, detalle: 'Preparación: En agua · Gaseosas: Ginger, Ginger' },
    ].sort((a, b) => a.detalle.localeCompare(b.detalle)));
    assert.equal(p.total, 42000, 'el servidor cobra lo mismo que mostró la web');
    assert.deepEqual(errores, []);
    await page.close();
  });

  test('si el dueño quita una gaseosa elegida, esa línea sale del carrito con un aviso', async () => {
    const clave = 'combo-opciones~' + JSON.stringify([['En agua'], ['Pepsi', 'Coca-Cola']]);
    const { page } = await abrir({ preparar: new Function(`localStorage.setItem('qb_carrito_v1', ${JSON.stringify(JSON.stringify({ [clave]: 1, clasica: 1 }))})`) });
    await ctx.staff('bebidas_guardar', { p: { gaseosas: ['Coca-Cola', 'Postobón Manzana'] } });
    await page.evaluate(() => window.__avisarCambio('ajustes'));
    await page.waitForFunction(() => Object.keys(JSON.parse(localStorage.getItem('qb_carrito_v1'))).length === 1, { timeout: 5000, polling: 50 });
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('qb_carrito_v1'))), { clasica: 1 });
    await ctx.staff('bebidas_guardar', { p: { gaseosas: ['Coca-Cola', 'Coca-Cola Zero', 'Postobón Manzana', 'Postobón Colombiana', 'Pepsi', 'Ginger'] } });
    await page.close();
  });
});

describe('forma de pago', () => {
  test('el cliente solo puede elegir Nequi o Efectivo', async () => {
    const { page } = await abrir();
    assert.deepEqual(await page.$$eval('[name=pago] option', (os) => os.map((o) => o.textContent)), ['Nequi', 'Efectivo']);
    await page.close();
  });
});

describe('compatibilidad y rendimiento', () => {
  test('sin Supabase configurado la web funciona como antes (menú de config.js)', async () => {
    peticiones.length = 0;
    const { page, errores } = await abrir({ conSupabase: false });
    await pedir(page, [['classic-burger', 1]]);
    const mensaje = await esperarWhatsApp(page);
    assert.match(mensaje, /1 x Classic Burger — \$17\.000/);
    assert.equal(peticiones.length, 0, 'no debe llamar a Supabase');
    assert.deepEqual(errores, []);
    await page.close();
  });

  test('el menú aparece en menos de 2,5 s aunque Supabase tarde (respaldo de config.js)', async () => {
    modoSupabase = 'lento';
    const t0 = Date.now();
    const { page } = await abrir();
    const ms = Date.now() - t0;
    modoSupabase = 'normal';
    assert.ok(ms < 2500, `el menú tardó ${ms} ms en aparecer`);
    await page.close();
  });

  test('la llave enviada es la pública (anon), nunca una secreta', () => {
    const llaves = new Set(peticiones.map((p) => p.apikey));
    for (const k of llaves) {
      const rol = JSON.parse(Buffer.from(k.split('.')[1], 'base64url').toString()).role;
      assert.equal(rol, 'anon');
    }
  });
});
