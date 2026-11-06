/**
 * Quechimba Pedidos · Proceso principal de Electron.
 * Seguridad: aislamiento de contexto, sandbox, sin Node en la interfaz,
 * protocolo propio app:// con lista blanca de carpetas y CSP estricta.
 */
import { app, BrowserWindow, ipcMain, protocol, net, shell, Notification, dialog } from 'electron';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { leerConfig, guardarConfig, validarConexion } from './config.js';
import { registrarDemo } from './demo.js';
import { generarPDF } from './pdf.js';
import { iniciarActualizador } from './actualizador.js';
import { rutaSupabaseUMD } from './rutas.js';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Si falta, falla al arrancar con un mensaje claro (no con una pantalla rota)
const SUPABASE_UMD = rutaSupabaseUMD();

const MODO_DEMO = process.argv.includes('--demo') || process.env.QB_DEMO === '1';
const ORIGEN = 'app://qb';

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, codeCache: true } },
]);

// Solo estas carpetas se pueden servir a la interfaz
const RUTAS = {
  '/renderer/': path.join(SRC, 'renderer'),
  '/shared/': path.join(SRC, 'shared'),
};

function resolverArchivo(urlTexto) {
  const { pathname } = new URL(urlTexto);
  const ruta = decodeURIComponent(pathname);
  if (ruta === '/vendor/supabase.js') return SUPABASE_UMD;
  for (const [prefijo, dir] of Object.entries(RUTAS)) {
    if (ruta.startsWith(prefijo)) {
      const archivo = path.normalize(path.join(dir, ruta.slice(prefijo.length)));
      if (archivo.startsWith(dir + path.sep)) return archivo; // evita ../../
    }
  }
  return null;
}

let ventana = null;

function crearVentana() {
  ventana = new BrowserWindow({
    width: 1380,
    height: 880,
    minWidth: 1120,
    minHeight: 720,
    show: false,
    backgroundColor: '#17120e',
    title: 'Quechimba Pedidos',
    icon: path.join(SRC, 'renderer', 'img', 'icono.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(SRC, 'preload', 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
      // App de pedidos: debe seguir escuchando aunque esté minimizada o detrás de otras ventanas
      backgroundThrottling: false,
    },
  });

  // Enlaces externos (WhatsApp, mapas) en el navegador; nada más se abre
  ventana.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  ventana.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(ORIGEN)) e.preventDefault();
  });

  ventana.once('ready-to-show', () => ventana.show());
  ventana.loadURL(`${ORIGEN}/renderer/index.html`);
  return ventana;
}

app.setAppUserModelId('com.quechimbaburger.pedidos');

// Pruebas automáticas: carpeta de datos aislada para no chocar con la app instalada
// (que solo permite una instancia abierta) ni tocar su configuración.
if (process.env.QB_USER_DATA) app.setPath('userData', process.env.QB_USER_DATA);

// Una sola instancia: si la abren dos veces, se enfoca la existente
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (ventana) { if (ventana.isMinimized()) ventana.restore(); ventana.focus(); }
  });

  app.whenReady().then(async () => {
    protocol.handle('app', (req) => {
      const archivo = resolverArchivo(req.url);
      if (!archivo) return new Response('No encontrado', { status: 404 });
      return net.fetch(pathToFileURL(archivo).toString());
    });

    // ---------- IPC ----------
    ipcMain.handle('config:leer', async () => ({
      ...(await leerConfig()),
      modoDemo: MODO_DEMO,
      version: app.getVersion(),
    }));
    ipcMain.handle('config:guardar', async (_e, datos) => {
      const error = validarConexion(datos);
      if (error) return { error };
      await guardarConfig(datos);
      return { ok: true };
    });
    ipcMain.handle('app:abrir-externo', (_e, url) => {
      if (typeof url === 'string' && /^https:\/\//.test(url)) shell.openExternal(url);
    });
    ipcMain.handle('app:notificar', (_e, { titulo, cuerpo }) => {
      if (Notification.isSupported()) {
        const n = new Notification({ title: String(titulo).slice(0, 80), body: String(cuerpo).slice(0, 200), silent: true });
        n.on('click', () => { ventana?.show(); ventana?.focus(); });
        n.show();
      }
    });
    ipcMain.handle('app:recargar', () => ventana?.webContents.reload());
    ipcMain.handle('pdf:reporte', (_e, datos) => generarPDF(ventana, datos, ORIGEN));

    if (MODO_DEMO) await registrarDemo(ipcMain, () => ventana);

    crearVentana();
    iniciarActualizador(() => ventana, ipcMain);
  }).catch((e) => {
    dialog.showErrorBox('Quechimba Pedidos no pudo iniciar', String(e?.stack ?? e));
    app.exit(1);
  });

  app.on('window-all-closed', () => app.quit());
}
