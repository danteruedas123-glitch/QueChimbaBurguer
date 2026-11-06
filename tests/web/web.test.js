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
import { nuevaBase } from '../helpers/bd.js';

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

const abrirCategoria = (page, slug) => page.$eval(`.cat[data-grupo="${slug}"]`, (d) => { d.open = true; });

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
    assert.equal(await page.$eval('[data-precio-de="quechimba"]', (e) => e.textContent), '$31.500', 'el precio de la portada también se actualiza');
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
    const { page, errores } = await abrir();
    await pedir(page, [['quechimba', 1]]);
    const mensaje = await esperarWhatsApp(page);
    modoSupabase = 'normal';
    assert.doesNotMatch(mensaje, /Pedido #/, 'sin registro no hay número');
    assert.match(mensaje, /1 x La Quechimba/);
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

describe('compatibilidad y rendimiento', () => {
  test('sin Supabase configurado la web funciona como antes (menú de config.js)', async () => {
    peticiones.length = 0;
    const { page, errores } = await abrir({ conSupabase: false });
    await pedir(page, [['clasica', 1]]);
    const mensaje = await esperarWhatsApp(page);
    assert.match(mensaje, /1 x La Clásica — \$18\.000/);
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
