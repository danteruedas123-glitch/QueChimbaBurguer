/**
 * PRUEBAS DE ESTRÉS de la app de escritorio (Electron real, modo demo:
 * base local, nunca la de producción). Intentos de leer archivos del
 * computador, abuso del puente con el sistema, código malicioso en el menú,
 * clics frenéticos, cobro doble, miles de pedidos y navegación sin parar.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { hoyEn } from '../../src/shared/periodos.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ELECTRON = path.join(RAIZ, 'node_modules', 'electron', 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron');
const PUERTO = 9700 + Math.floor(Math.random() * 400);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

let proc; let browser; let page;
const errores = [];
let salidaPrincipal = '';
const rpc = (nombre, args = {}) => page.evaluate(async (n, a) => window.qb.demo.rpc(n, a), nombre, args);
const irA = async (vista, selector) => {
  await page.evaluate((v) => { location.hash = v; }, vista);
  // Se suelta la referencia: si no, la herramienta de pruebas retiene la pantalla vieja en memoria
  await (await page.waitForSelector(selector, { timeout: 20000, polling: 100 })).dispose();
  await espera(60); // ritmo humano: Chromium frena más de ~200 navegaciones en pocos segundos
};
const procesoVivo = async () => (await page.evaluate(() => window.qb.config.leer())).modoDemo === true;

before(async () => {
  assert.ok(existsSync(ELECTRON), 'falta Electron: node node_modules/electron/install.js');
  const { ELECTRON_RUN_AS_NODE, ...entorno } = process.env;
  proc = spawn(ELECTRON, ['.', '--demo', `--remote-debugging-port=${PUERTO}`], {
    cwd: RAIZ, env: { ...entorno, QB_USER_DATA: await mkdtemp(path.join(os.tmpdir(), 'qb-estres-')), QB_E2E_PDF: await mkdtemp(path.join(os.tmpdir(), 'qb-pdf-')) },
  });
  proc.stdout.on('data', (d) => { salidaPrincipal += d; });
  proc.stderr.on('data', (d) => { salidaPrincipal += d; });
  for (let i = 0; i < 120 && !browser; i++) { try { browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PUERTO}`, defaultViewport: null }); } catch { await espera(250); } }
  for (let i = 0; i < 120 && !page; i++) { page = (await browser.pages()).find((p) => p.url().startsWith('app://')); if (!page) await espera(250); }
  page.on('pageerror', (e) => errores.push(e.message));
  await page.setViewport({ width: 1366, height: 768 });
  await page.waitForSelector('[data-form]', { timeout: 30000 });
  await page.type('[name=password]', 'demo1234');
  await page.click('[data-entrar]');
  await page.waitForSelector('.tablero', { timeout: 30000 });
});
after(async () => { await browser?.disconnect(); proc?.kill(); });

// ---------------------------------------------------------------- seguridad
test('no se puede leer ningún archivo del computador por el protocolo de la app', async () => {
  const intentos = [
    'app://qb/renderer/../main/main.js', 'app://qb/renderer/%2e%2e/main/main.js', 'app://qb/renderer/..%2fmain%2fmain.js',
    'app://qb/renderer/..%5cmain%5cmain.js', 'app://qb/renderer/..%5c..%5cpackage.json', 'app://qb/shared/../../package.json',
    'app://qb/package.json', 'app://qb/main/config.js', 'app://qb/renderer/%00../main/main.js', 'app://qb//etc/passwd',
    'app://qb/renderer/..%255cmain%255cmain.js', 'app://otro/renderer/index.html', 'app://qb/C:/Windows/win.ini', 'app://qb/vendor/../package.json',
  ];
  const r = await page.evaluate(async (urls) => Promise.all(urls.map(async (u) => {
    try {
      const res = await fetch(u);
      const t = await res.text();
      return { u, estado: res.status, filtra: /import \{|"dependencies"|\[fonts\]|electron/.test(t) };
    } catch { return { u, estado: 'bloqueado', filtra: false }; }
  })), intentos);
  assert.deepEqual(r.filter((x) => x.filtra), [], 'ningún archivo interno se filtró');
  assert.ok(await procesoVivo(), 'la app sigue viva');
});

test('la interfaz no puede salir de la app ni ejecutar código externo', async () => {
  const r = await page.evaluate(async () => {
    const res = {};
    // (eval desde las herramientas de prueba está exento de la política; se revisa la política misma)
    const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content ?? '';
    const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src')) ?? '';
    res.evalOk = /unsafe-eval|unsafe-inline/.test(scriptSrc) || !/script-src 'self'/.test(csp);
    const s = document.createElement('script'); s.textContent = 'window.__inline = true'; document.body.append(s);
    res.inline = !!window.__inline;
    const ext = document.createElement('script'); ext.src = 'https://ejemplo-malo.com/x.js'; document.body.append(ext);
    await new Promise((r) => setTimeout(r, 800));
    res.externo = typeof window.__malo !== 'undefined';
    res.node = typeof require !== 'undefined' || typeof process !== 'undefined';
    res.ventana = window.open('https://ejemplo-malo.com') !== null;
    return res;
  });
  assert.deepEqual(r, { evalOk: false, inline: false, externo: false, node: false, ventana: false });
  await page.evaluate(() => { location.href = 'https://ejemplo-malo.com'; }).catch(() => {});
  await espera(800);
  assert.ok(page.url().startsWith('app://'), `la app no navegó afuera: ${page.url()}`);
});

test('abuso del puente con el sistema: 600 llamadas con basura no tumban la app', async () => {
  const r = await page.evaluate(async () => {
    const basura = [null, undefined, 1, 'x'.repeat(100000), [], {}, { titulo: {}, cuerpo: [] }, () => 1, Symbol.iterator, new Array(10000).fill('a')];
    const llamadas = [
      (b) => window.qb.demo.rpc(b, b), (b) => window.qb.demo.rpc('pedido_cambiar_estado', b), (b) => window.qb.demo.rpc('_insertar_items', b),
      (b) => window.qb.demo.rpc('tg_pago_permitido', b), (b) => window.qb.demo.login(b, b), (b) => window.qb.config.guardar(b),
      (b) => window.qb.notificar(b, b), (b) => window.qb.pdf.reporte(b), (b) => window.qb.abrirExterno(b),
      (b) => window.qb.abrirExterno('file:///C:/Windows/System32/calc.exe'), (b) => window.qb.abrirExterno('javascript:alert(1)'),
    ];
    let ok = 0; let rechazos = 0;
    for (let i = 0; i < 600; i++) {
      try { await llamadas[i % llamadas.length](basura[i % basura.length]); ok++; } catch { rechazos++; }
    }
    return { ok, rechazos };
  });
  assert.equal(r.ok + r.rechazos, 600);
  assert.ok(await procesoVivo(), 'el proceso principal sigue vivo');
  const sesion = await page.evaluate(() => window.qb.demo.sesion());
  assert.ok(sesion, 'la sesión sigue activa');
  const interna = await rpc('_insertar_items', { p_pedido: '00000000-0000-0000-0000-000000000000', p_lineas: [], p_solo_disponibles: false });
  assert.ok(interna.error, 'las funciones internas no se pueden llamar desde la interfaz');
});

test('código malicioso en los nombres del menú: se muestra como texto en todas las pantallas', async () => {
  const MAL = '<img src=x onerror="window.__xss=1">';
  const menu = (await rpc('menu_admin')).datos;
  const cat = menu.categorias[0].id;
  const p = (await rpc('producto_guardar', { p: { categoria_id: cat, nombre: `Hack ${MAL}`.slice(0, 60), descripcion: MAL, precio: 1000, etiqueta: '<b>x</b>',
    opciones: [{ titulo: '<svg onload=x>', elige: 1, opciones: [{ nombre: MAL.slice(0, 40), extra: 0 }, { nombre: 'Normal', extra: 0 }] }] } })).datos;
  await rpc('venta_registrar', { p_items: [{ producto_id: p.id, cantidad: 1, opciones: [[MAL.slice(0, 40)]] }], p_datos: { canal: 'local', tipo_entrega: 'en_local', metodo_pago: 'efectivo', cliente_nombre: MAL.slice(0, 60), notas: MAL, entregado: false } });
  for (const [vista, sel] of [['menu', '.menu-admin'], ['venta', '.rejilla-productos'], ['pedidos', '.tablero'], ['contabilidad', '[data-kpi="total"]']]) {
    await irA(vista, sel);
    await espera(400);
  }
  await irA('venta', '.rejilla-productos .producto-btn');
  await page.click(`[data-producto="${p.id}"]`);
  await page.waitForSelector('dialog.modal');
  await page.click('dialog.modal [data-cerrar]');
  const r = await page.evaluate(() => ({ xss: window.__xss ?? 0, imgs: document.querySelectorAll('img[src="x"]').length }));
  assert.deepEqual(r, { xss: 0, imgs: 0 });
  await rpc('producto_guardar', { p: { id: p.id, categoria_id: cat, nombre: 'Producto de prueba', precio: 1000, activo: false } });
});

// ---------------------------------------------------------------- abuso de la caja
test('clics frenéticos: 400 clics en un producto se topan en 99 y el total cuadra', async () => {
  await irA('venta', '.rejilla-productos .producto-btn');
  const menu = (await rpc('menu_admin')).datos;
  const classic = menu.productos.find((x) => x.slug === 'classic-burger');
  // Cada clic redibuja la rejilla: se toca el botón vigente, como un dedo real
  await page.evaluate((id) => { for (let i = 0; i < 400; i++) document.querySelector(`[data-producto="${id}"]`).click(); }, classic.id);
  await espera(300);
  const r = await page.evaluate(() => ({ total: document.querySelector('[data-total]').textContent, cant: document.querySelector('.lineas-ticket output')?.textContent }));
  assert.equal(r.cant, '99');
  assert.equal(r.total, `$${(classic.precio * 99).toLocaleString('es-CO')}`);
  await page.click('[data-limpiar]');
});

test('cajero impaciente: 15 clics seguidos en "Registrar venta" cobran UNA sola vez', async () => {
  const antes = (await rpc('reporte_ventas', { p_desde: hoyEn(), p_hasta: hoyEn() })).datos.resumen.pedidos;
  const menu = (await rpc('menu_admin')).datos;
  const smash = menu.productos.find((x) => x.slug === 'smash-burger');
  await page.click(`[data-producto="${smash.id}"]`);
  await page.evaluate(() => { for (let i = 0; i < 15; i++) document.querySelector('[data-registrar]').click(); });
  await page.waitForFunction(() => document.querySelector('[data-total]').textContent === '$0', { timeout: 10000 });
  await espera(1500);
  const despues = (await rpc('reporte_ventas', { p_desde: hoyEn(), p_hasta: hoyEn() })).datos.resumen.pedidos;
  assert.equal(despues - antes, 1, `se registraron ${despues - antes} ventas`);
});

// ---------------------------------------------------------------- volumen y resistencia
test('día de locos: 1.500 pedidos pendientes hoy; el tablero y la contabilidad responden', async () => {
  // La web frena en 60 pedidos cada 10 min (anti-avalancha); la caja no tiene ese límite
  const t0 = Date.now();
  await page.evaluate(async () => {
    for (let i = 0; i < 25; i++) {
      await Promise.all(Array.from({ length: 60 }, (_, k) => window.qb.demo.rpc('venta_registrar', {
        p_items: [{ slug: ['classic-burger', 'salchichimba', 'smash-burger'][k % 3], cantidad: 1 + (k % 3) }],
        p_datos: { canal: 'whatsapp', tipo_entrega: 'domicilio', direccion: 'Calle ' + k, metodo_pago: 'transferencia', cliente_nombre: 'Cliente ' + k, entregado: false },
      })));
    }
  });
  const carga = Date.now() - t0;
  const t1 = Date.now();
  const activos = (await rpc('pedidos_listar', { p_desde: hoyEn(), p_hasta: hoyEn() })).datos.filter((p) => !['entregado', 'cancelado'].includes(p.estado)).length;
  await irA('pedidos', '.tablero');
  await page.waitForFunction((n) => document.querySelectorAll('article.pedido').length >= n, { timeout: 30000, polling: 100 }, activos);
  const tablero = Date.now() - t1;
  console.log(`    tarjetas en el tablero: ${await page.$$eval('article.pedido', (x) => x.length)} (activos ${activos})`);
  const t2 = Date.now();
  await irA('contabilidad', '[data-kpi="total"]');
  const conta = Date.now() - t2;
  console.log(`    1.500 pedidos: creados en ${carga} ms · tablero ${tablero} ms · contabilidad ${conta} ms`);
  assert.ok(tablero < 15000, `tablero ${tablero} ms`);
  assert.ok(conta < 10000, `contabilidad ${conta} ms`);
  assert.ok(await procesoVivo());
});

test('PDF de contabilidad de todo el mes con miles de pedidos', async () => {
  const hoy = hoyEn();
  const reporte = (await rpc('reporte_ventas', { p_desde: `${hoy.slice(0, 8)}01`, p_hasta: hoy })).datos;
  const t = Date.now();
  const r = await page.evaluate((rep) => window.qb.pdf.reporte({ reporte: rep, generado: new Date().toISOString() }), reporte);
  const ms = Date.now() - t;
  console.log(`    PDF del mes (${reporte.resumen.pedidos} pedidos): ${ms} ms`);
  assert.ok(!r?.error, JSON.stringify(r));
  assert.ok(ms < 20000, `${ms} ms`);
});

test('navegación sin parar: 120 cambios de pantalla sin fugas de memoria ni errores', async () => {
  const cdp = await page.createCDPSession();
  const memoria = async () => { await cdp.send('HeapProfiler.collectGarbage'); return (await page.metrics()).JSHeapUsedSize; };
  const vistas = [['pedidos', '.tablero'], ['venta', '.rejilla-productos'], ['menu', '.menu-admin'], ['ajustes', '.ajustes']];
  for (let i = 0; i < 8; i++) for (const [v, s] of vistas) await irA(v, s);
  const m0 = await memoria();
  for (let i = 0; i < 30; i++) for (const [v, s] of vistas) await irA(v, s);
  const m1 = await memoria();
  for (let i = 0; i < 30; i++) for (const [v, s] of vistas) await irA(v, s);
  const m2 = await memoria();
  console.log(`    memoria: ${(m0 / 1e6).toFixed(1)} → ${(m1 / 1e6).toFixed(1)} → ${(m2 / 1e6).toFixed(1)} MB (cada 120 cambios)`);
  assert.ok(m2 - m1 < 1.5e6, `sigue creciendo: +${((m2 - m1) / 1e6).toFixed(1)} MB en la segunda tanda (fuga)`);
  assert.deepEqual(errores, [], 'sin errores de JavaScript en toda la sesión');
});

test('ventana al tamaño mínimo y pantalla grande: la caja no se desborda', async () => {
  for (const [w, h] of [[1120, 720], [1280, 720], [2560, 1440]]) {
    await page.setViewport({ width: w, height: h });
    await irA('venta', '.rejilla-productos .producto-btn');
    await espera(300);
    const r = await page.evaluate(() => {
      const t = document.querySelector('.ticket').getBoundingClientRect();
      const b = document.querySelector('[data-registrar]').getBoundingClientRect();
      return { desborde: document.documentElement.scrollWidth - innerWidth, ticketVisible: t.right <= innerWidth + 1, botonVisible: b.bottom <= innerHeight + 1 && b.height > 30 };
    });
    assert.deepEqual(r, { desborde: 0, ticketVisible: true, botonVisible: true }, `${w}×${h}`);
  }
});
