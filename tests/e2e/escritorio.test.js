/**
 * Pruebas END-TO-END de la app de escritorio (Electron real, modo demo).
 * Recorren los flujos del encargado y verifican que la interfaz y la base
 * de datos digan lo mismo. Incluye pruebas no funcionales: arranque,
 * rendimiento de navegación, seguridad del proceso y errores de consola.
 *   Capturas: QB_CAPTURAS=<carpeta> npm run test:e2e
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { hoyEn } from '../../src/shared/periodos.js';
import { formatearCOP } from '../../src/shared/dinero.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ELECTRON = path.join(RAIZ, 'node_modules', 'electron', 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron');
const PUERTO = 9333 + Math.floor(Math.random() * 500);
const CAPTURAS = process.env.QB_CAPTURAS;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
// Los servidores de GitHub Actions son más lentos: solo los límites de TIEMPO se amplían allí
const FACTOR = process.env.CI ? 3 : 1;

let proc;
let browser;
let page;
let dirPDF;
let tiempoArranque;
const erroresConsola = [];
let ignorarConsola = false; // la prueba de seguridad provoca errores a propósito

const rpc = (nombre, args = {}) => page.evaluate(async (n, a) => window.qb.demo.rpc(n, a), nombre, args);
const captura = async (nombre) => { if (CAPTURAS) await page.screenshot({ path: path.join(CAPTURAS, `${nombre}.png`) }); };
const texto = (sel) => page.$eval(sel, (el) => el.textContent.trim());
const irA = async (vista, selector) => {
  await page.evaluate((v) => { location.hash = v; }, vista);
  await page.waitForSelector(selector, { timeout: 15000, polling: 100 });
};

before(async () => {
  if (!process.env.QB_EJECUTABLE) {
    assert.ok(existsSync(ELECTRON), `No está el programa de Electron en ${ELECTRON}. Ejecuta: node node_modules/electron/install.js`);
  }
  dirPDF = await mkdtemp(path.join(os.tmpdir(), 'qb-pdf-'));
  const dirDatos = await mkdtemp(path.join(os.tmpdir(), 'qb-datos-'));
  const t0 = Date.now();
  // VS Code define ELECTRON_RUN_AS_NODE en sus terminales internas; hay que quitarla
  const { ELECTRON_RUN_AS_NODE, ...entorno } = process.env;
  // QB_EJECUTABLE permite probar la app YA EMPAQUETADA (ej. dist/win-unpacked/Quechimba Pedidos.exe)
  const exe = process.env.QB_EJECUTABLE;
  proc = spawn(exe ?? ELECTRON, [...(exe ? [] : ['.']), '--demo', `--remote-debugging-port=${PUERTO}`], {
    cwd: RAIZ, env: { ...entorno, QB_E2E_PDF: dirPDF, QB_USER_DATA: dirDatos },
  });
  // Diagnóstico: lo que Electron escribe y si se cierra antes de tiempo
  let salidaElectron = '';
  let codigoSalida = null;
  proc.stdout.on('data', (d) => { salidaElectron += d; });
  proc.stderr.on('data', (d) => { salidaElectron += d; });
  proc.on('exit', (c) => { codigoSalida = c; });
  proc.on('error', (e) => { codigoSalida = 'no se pudo abrir'; salidaElectron += `
${e.message}`; });
  const intentos = 80 * FACTOR; // 20 s en tu PC, 60 s en GitHub Actions
  for (let i = 0; i < intentos && !browser && codigoSalida === null; i++) {
    try { browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PUERTO}`, defaultViewport: null }); } catch { await espera(250); }
  }
  assert.ok(browser, `no se pudo conectar con Electron (código de salida: ${codigoSalida}). Salida:
${salidaElectron.slice(-1500)}`);
  for (let i = 0; i < intentos && !page; i++) {
    page = (await browser.pages()).find((p) => p.url().startsWith('app://'));
    if (!page) await espera(250);
  }
  page.on('console', (m) => { if (!ignorarConsola && ['error', 'warn'].includes(m.type())) erroresConsola.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => erroresConsola.push(`pageerror: ${e.message}`));
  await page.setViewport({ width: 1380, height: 860 });
  await page.waitForSelector('[data-form]', { timeout: 30000 });
  tiempoArranque = Date.now() - t0;
});

after(async () => {
  await browser?.disconnect();
  proc?.kill();
});

// ---------------------------------------------------------------- acceso
test('arranca en menos de 15 s y muestra el inicio de sesión', async () => {
  assert.ok(tiempoArranque < 15000 * FACTOR, `arranque: ${tiempoArranque} ms`);
  await captura('01-login');
});

test('rechaza una contraseña incorrecta con un mensaje claro', async () => {
  await page.type('[name=password]', 'equivocada');
  await page.click('[data-entrar]');
  await page.waitForSelector('[data-error]:not([hidden])');
  assert.match(await texto('[data-error]'), /incorrectos/);
});

test('entra con las credenciales correctas al tablero de pedidos', async () => {
  await page.$eval('[name=password]', (el) => { el.value = ''; });
  await page.type('[name=password]', 'demo1234');
  await page.click('[data-entrar]');
  await page.waitForSelector('.tablero', { timeout: 20000 });
  await espera(600);
  await captura('02-pedidos');
});

// ---------------------------------------------------------------- seguridad del proceso
test('la interfaz no tiene acceso a Node.js ni al sistema', async () => {
  const r = await page.evaluate(() => ({
    require: typeof window.require, process: typeof window.process, module: typeof window.module,
    puente: Object.keys(window.qb).sort(),
  }));
  assert.deepEqual([r.require, r.process, r.module], ['undefined', 'undefined', 'undefined']);
  assert.deepEqual(r.puente, ['abrirExterno', 'actualizador', 'config', 'demo', 'notificar', 'pdf', 'recargar']);
});

test('la librería de Supabase carga en la interfaz (necesaria fuera del modo demo)', async () => {
  assert.equal(await page.evaluate(() => typeof window.supabase?.createClient), 'function');
});

test('no puede navegar fuera de la app ni leer archivos del disco', async () => {
  ignorarConsola = true;
  const url = page.url();
  await page.evaluate(() => { location.href = 'https://example.com'; }).catch(() => {});
  await espera(500);
  assert.equal(page.url().split('#')[0], url.split('#')[0]);
  const r = await page.evaluate(async () => {
    const intentos = ['app://qb/../package.json', 'app://qb/renderer/../../package.json', 'app://qb/main/main.js', 'file:///C:/Windows/win.ini'];
    return Promise.all(intentos.map((u) => fetch(u).then((x) => x.status).catch(() => 'bloqueado')));
  });
  for (const s of r) assert.ok(s === 404 || s === 'bloqueado', `acceso indebido: ${s}`);
  await espera(300);
  ignorarConsola = false;
});

// ---------------------------------------------------------------- pedidos
test('un pedido web llega en vivo, suma al contador y se resalta', async () => {
  const antes = await page.$$eval('[data-columna="nuevo"] .pedido', (x) => x.length);
  const r = await page.evaluate(() => window.qb.demo.simularPedidoWeb());
  assert.ok(r.datos.numero > 0);
  await page.waitForFunction((n) => document.querySelectorAll('[data-columna="nuevo"] .pedido').length === n + 1, { timeout: 10000, polling: 100 }, antes);
  const resaltado = await page.$eval(`[data-pedido="${r.datos.numero}"]`, (el) => el.classList.contains('es-nuevo'));
  assert.ok(resaltado, 'el pedido nuevo debe resaltarse');
  assert.equal(Number(await texto('[data-contador]')), antes + 1);
  await captura('03-pedido-nuevo');
});

test('flujo completo del pedido web hasta entregado, cobrando el domicilio', async () => {
  const { datos: nuevo } = await page.evaluate(() => window.qb.demo.simularPedidoWeb());
  const sel = `[data-pedido="${nuevo.numero}"]`;
  await page.waitForSelector(sel);
  const vendidoAntes = await texto('[data-vendido-hoy]');

  await page.click(`${sel} [data-accion="avanzar"]`);                       // → preparando
  await page.waitForSelector(`[data-columna="preparando"] ${sel}`);
  await page.click(`${sel} [data-accion="avanzar"]`);                       // → listo
  await page.waitForSelector(`[data-columna="listo"] ${sel}`);
  await page.click(`${sel} [data-accion="avanzar"]`);                       // → pide domicilio
  await page.waitForSelector('dialog.modal [name=domicilio]');
  await page.type('dialog.modal [name=domicilio]', '4.000');
  await page.click('dialog.modal [data-aceptar]');
  await page.waitForFunction((s) => !document.querySelector(`.columna:not(.columna--cerrados) ${s}`), { timeout: 10000, polling: 100 }, sel);

  const [pedido] = (await rpc('pedidos_listar', { p_desde: hoyEn(), p_hasta: hoyEn() })).datos.filter((p) => p.numero === nuevo.numero);
  assert.equal(pedido.estado, 'entregado');
  assert.equal(pedido.costo_domicilio, 4000);
  assert.equal(pedido.total, nuevo.total + 4000);
  assert.notEqual(await texto('[data-vendido-hoy]'), vendidoAntes);
});

test('cancelar un pedido lo saca del tablero y no cuenta como venta', async () => {
  const { datos: nuevo } = await page.evaluate(() => window.qb.demo.simularPedidoWeb());
  const sel = `[data-pedido="${nuevo.numero}"]`;
  await page.waitForSelector(sel);
  await page.click(`${sel} [data-accion="cancelar"]`);
  await page.waitForSelector('dialog.modal [name=motivo]');
  await page.type('dialog.modal [name=motivo]', 'Prueba automática');
  await page.click('dialog.modal [data-aceptar]');
  await page.waitForFunction((s) => !document.querySelector(s), { timeout: 10000, polling: 100 }, sel);
  const [p] = (await rpc('pedidos_listar', { p_desde: hoyEn(), p_hasta: hoyEn() })).datos.filter((x) => x.numero === nuevo.numero);
  assert.equal(p.estado, 'cancelado');
});

// ---------------------------------------------------------------- venta manual y contabilidad
test('registrar una venta de mostrador suma exactamente a la contabilidad de hoy', async () => {
  const antes = (await rpc('reporte_ventas', { p_desde: hoyEn(), p_hasta: hoyEn() })).datos.resumen.total;
  await irA('venta', '.rejilla-productos .producto-btn');
  const menu = (await rpc('menu_admin')).datos;
  const clasica = menu.productos.find((p) => p.slug === 'clasica');
  const limonada = menu.productos.find((p) => p.slug === 'limonada');
  await page.click(`[data-producto="${clasica.id}"]`);
  await page.click(`[data-producto="${clasica.id}"]`);
  await page.click(`[data-producto="${limonada.id}"]`);
  await page.type('[data-descuento]', '2.000');
  const esperado = clasica.precio * 2 + limonada.precio - 2000;
  assert.equal(await texto('[data-total]'), formatearCOP(esperado));
  await captura('04-venta');
  await page.click('[data-registrar]');
  await page.waitForFunction(() => document.querySelector('[data-total]').textContent === '$0', { timeout: 10000, polling: 100 });
  const despues = (await rpc('reporte_ventas', { p_desde: hoyEn(), p_hasta: hoyEn() })).datos.resumen.total;
  assert.equal(despues - antes, esperado);
});

test('la contabilidad muestra las mismas cifras que la base de datos', async () => {
  await irA('contabilidad', '[data-kpi="total"]');
  const r = (await rpc('reporte_ventas', { p_desde: hoyEn(), p_hasta: hoyEn() })).datos;
  assert.equal(await texto('[data-kpi="total"]'), formatearCOP(r.resumen.total));
  assert.equal(await texto('[data-kpi="pedidos"]'), String(r.resumen.pedidos));
  await page.click('[data-periodo="mes"]');
  await page.waitForFunction(() => !document.querySelector('.contenido .vacio') || document.querySelector('[data-kpi="total"]'), { timeout: 15000, polling: 100 });
  await page.waitForSelector('[data-kpi="total"]');
  await espera(300);
  await captura('05-contabilidad-mes');
  const barras = await page.$$eval('.grafica path.barra-dato', (x) => x.length);
  assert.ok(barras >= 1, 'debe haber barras en la gráfica');
});

test('un rango de fechas inválido muestra un aviso y no consulta', async () => {
  await page.click('[data-periodo="personal"]');
  await page.waitForSelector('[data-rango]');
  await page.$eval('[data-rango] [name=desde]', (el) => { el.value = '2026-11-05'; });
  await page.$eval('[data-rango] [name=hasta]', (el) => { el.value = '2026-11-01'; });
  await page.click('[data-rango] button');
  await page.waitForSelector('.toast.error');
  assert.match(await texto('.toast.error'), /anterior/);
});

test('descarga el PDF de contabilidad (archivo válido, con varias páginas si hace falta)', async () => {
  await page.click('[data-periodo="mes"]');
  await page.waitForSelector('[data-pdf]:not([disabled])');
  const t0 = Date.now();
  await page.click('[data-pdf]');
  let archivos = [];
  for (let i = 0; i < 60 && !archivos.length; i++) { archivos = (await readdir(dirPDF)).filter((f) => f.endsWith('.pdf')); if (!archivos.length) await espera(250); }
  assert.equal(archivos.length, 1, 'se debe generar un PDF');
  const pdf = await readFile(path.join(dirPDF, archivos[0]));
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok(pdf.length > 15_000, `PDF muy pequeño: ${pdf.length} bytes`);
  assert.match(archivos[0], /^Contabilidad_Quechimba_\d{4}-\d{2}-\d{2}_a_\d{4}-\d{2}-\d{2}\.pdf$/);
  assert.ok(Date.now() - t0 < 15000 * FACTOR, 'el PDF debe generarse en menos de 15 s');
});

// ---------------------------------------------------------------- menú
test('crear un plato desde la app lo publica en el menú de la web', async () => {
  await irA('menu', '[data-nuevo]');
  await page.click('[data-nuevo]');
  await page.waitForSelector('dialog.modal [name=nombre]');
  await page.type('dialog.modal [name=nombre]', 'Hamburguesa Prueba E2E');
  await page.type('dialog.modal [name=descripcion]', 'Creada por la prueba automática');
  await page.type('dialog.modal [name=precio]', '12.345');
  await captura('06-menu-nuevo');
  await page.click('dialog.modal [data-aceptar]');
  await page.waitForFunction(() => !document.querySelector('dialog.modal'), { timeout: 10000, polling: 100 });
  const web = (await rpc('menu_publico')).datos;
  const p = web.productos.find((x) => x.nombre === 'Hamburguesa Prueba E2E');
  assert.ok(p, 'debe aparecer en la web');
  assert.equal(p.precio, 12345);
  await captura('07-menu');
});

test('un precio mal escrito no se guarda', async () => {
  await page.click('[data-nuevo]');
  await page.waitForSelector('dialog.modal [name=nombre]');
  await page.type('dialog.modal [name=nombre]', 'Precio malo');
  await page.type('dialog.modal [name=precio]', '12,5');
  await page.click('dialog.modal [data-aceptar]');
  await page.waitForSelector('dialog.modal [data-error]:not([hidden])');
  assert.match(await texto('dialog.modal [data-error]'), /pesos/);
  await page.click('dialog.modal [data-cerrar]');
});

test('marcar agotado se refleja en la web', async () => {
  const web0 = (await rpc('menu_publico')).datos;
  const p = web0.productos.find((x) => x.nombre === 'Hamburguesa Prueba E2E');
  const admin = (await rpc('menu_admin')).datos.productos.find((x) => x.slug === p.slug);
  await page.click(`[data-alternar="agotado"][data-id="${admin.id}"]`);
  await page.waitForFunction(async (slug) => {
    const r = await window.qb.demo.rpc('menu_publico', {});
    return r.datos.productos.find((x) => x.slug === slug)?.agotado === true;
  }, { timeout: 10000, polling: 100 }, p.slug);
});

test('un nombre con código malicioso se muestra como texto y no se ejecuta', async () => {
  const cat = (await rpc('menu_admin')).datos.categorias[0];
  await rpc('producto_guardar', { p: { categoria_id: cat.id, nombre: '<img src=x onerror="window.__xss=1">', precio: 1000 } });
  await irA('venta', '.producto-btn');
  await irA('menu', '[data-nuevo]');
  await page.click(`[data-cat="${cat.id}"]`);
  await espera(500);
  const r = await page.evaluate(() => ({ xss: window.__xss, visible: document.body.textContent.includes('<img src=x onerror=') }));
  assert.equal(r.xss, undefined, 'no debe ejecutarse código inyectado');
  assert.ok(r.visible, 'el nombre debe verse como texto');
});

// ---------------------------------------------------------------- ajustes
test('el botón "Desactivar web" (con confirmación) bloquea los pedidos y avisa en la barra', async () => {
  await irA('ajustes', '[data-web]');
  assert.equal(await texto('[data-web]'), 'Desactivar web');
  await page.click('[data-web]');
  await page.waitForSelector('dialog.modal [data-aceptar]');
  await captura('08-confirmar-desactivar');
  await page.click('dialog.modal [data-aceptar]');
  await page.waitForFunction(async () => (await window.qb.demo.rpc('menu_publico', {})).datos.pedidos_web_activos === false, { timeout: 10000, polling: 100 });
  await page.waitForFunction(() => document.querySelector('[data-chip-web]')?.textContent === 'Web desactivada', { timeout: 10000, polling: 100 });
  assert.equal(await texto('[data-web-texto]'), 'Web desactivada');
  const r = await page.evaluate(() => window.qb.demo.simularPedidoWeb());
  assert.equal(r.error?.hint, 'PEDIDOS_PAUSADOS', 'el servidor rechaza pedidos con la web desactivada');
  await captura('09-web-desactivada');
  await page.click('[data-web]'); // activar no pide confirmación
  await page.waitForFunction(async () => (await window.qb.demo.rpc('menu_publico', {})).datos.pedidos_web_activos === true, { timeout: 10000, polling: 100 });
  await page.waitForFunction(() => document.querySelector('[data-chip-web]')?.textContent === 'Web activada', { timeout: 10000, polling: 100 });
});

test('cancelar la confirmación deja la web activada', async () => {
  await page.click('[data-web]');
  await page.waitForSelector('dialog.modal [data-cerrar]');
  await page.click('dialog.modal button[data-cerrar].btn');
  await page.waitForFunction(() => !document.querySelector('dialog.modal'), { timeout: 5000, polling: 100 });
  assert.equal((await rpc('menu_publico')).datos.pedidos_web_activos, true);
  assert.equal(await texto('[data-web-texto]'), 'Web activada');
});

// ---------------------------------------------------------------- no funcionales
test('cambiar de sección es rápido (< 1,5 s cada una)', async () => {
  for (const [vista, sel] of [['pedidos', '.tablero'], ['venta', '.producto-btn'], ['menu', '[data-nuevo]'], ['contabilidad', '[data-kpi="total"]'], ['ajustes', '[data-web]']]) {
    const t0 = Date.now();
    await irA(vista, sel);
    const ms = Date.now() - t0;
    assert.ok(ms < 1500 * FACTOR, `${vista} tardó ${ms} ms`);
  }
});

test('volver varias veces a una sección no duplica acciones (un clic = una ventana)', async () => {
  for (let i = 0; i < 3; i++) {
    await irA('pedidos', '.tablero');
    await irA('menu', '[data-editar]');
  }
  await page.click('[data-editar]');
  await espera(600);
  assert.equal(await page.$$eval('dialog.modal', (x) => x.length), 1);
  await page.click('dialog.modal [data-cerrar]');
  await page.waitForFunction(() => !document.querySelector('dialog.modal'), { timeout: 5000, polling: 100 });
});

test('todos los botones con solo ícono tienen nombre accesible', async () => {
  const sinNombre = await page.evaluate(async () => {
    const malos = [];
    for (const v of ['pedidos', 'venta', 'menu']) {
      location.hash = v;
      await new Promise((r) => setTimeout(r, 900));
      document.querySelectorAll('button, a').forEach((b) => {
        const nombre = (b.getAttribute('aria-label') || b.textContent || b.title || '').trim();
        if (!nombre) malos.push(`${v}: ${b.outerHTML.slice(0, 80)}`);
      });
    }
    return malos;
  });
  assert.deepEqual(sinNombre, []);
});

test('sin errores en la consola durante toda la sesión', () => {
  // Se ignoran: el aviso de Electron en desarrollo y fallos de red al cargar fotos
  // de internet (la app ya muestra el logo en su lugar; no es un error de la app).
  const reales = erroresConsola.filter((e) => !/Electron Security Warning|Failed to load resource: net::/.test(e));
  assert.deepEqual(reales, []);
});
