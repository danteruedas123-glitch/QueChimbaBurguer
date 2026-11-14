/**
 * Actualizaciones automáticas.
 *  • Windows: desde GitHub Releases con electron-updater. Busca al abrir y
 *    cada 4 horas, descarga en segundo plano y se instala al CERRAR la app
 *    (nunca interrumpe el servicio) o con "Reiniciar y actualizar".
 *  • Linux (Chromebook): avisa que hay versión nueva; con "Actualizar ahora"
 *    descarga el .deb, verifica su huella sha512 y lo instala con apt, y la
 *    app se vuelve a abrir sola. Si apt pide contraseña, muestra los comandos.
 */
import { app, net } from 'electron';
import path from 'node:path';
import updaterPkg from 'electron-updater';
import { URL_ULTIMA, revisarPublicacion, comandosManuales, descargarEInstalar, ejecutarSinConsola } from './version-linux.js';

const { autoUpdater } = updaterPkg;
const CADA_4_HORAS = 4 * 60 * 60 * 1000;
const ES_LINUX = process.platform === 'linux';
const CABECERAS = { 'User-Agent': 'quechimba-pedidos' };

export function iniciarActualizador(ventana, ipcMain) {
  let estado = { estado: app.isPackaged ? 'inactivo' : 'desarrollo', version: app.getVersion(), plataforma: process.platform };
  let pendiente = null; // { nueva, url, archivo } en Linux
  let instalando = false;
  const emitir = (nuevo) => {
    estado = { ...estado, ...nuevo };
    ventana()?.webContents.send('updater:estado', estado);
  };

  async function buscarLinux() {
    if (instalando) return;
    emitir({ estado: 'buscando' });
    try {
      const r = await net.fetch(URL_ULTIMA, { headers: { ...CABECERAS, Accept: 'application/vnd.github+json' } });
      if (!r.ok) throw new Error(`GitHub respondió ${r.status}`);
      const info = revisarPublicacion(await r.json(), app.getVersion(), process.arch);
      pendiente = info.estado === 'disponible' ? info : null;
      emitir(info.estado === 'disponible' ? { estado: 'disponible', nueva: info.nueva } : info);
    } catch (e) {
      emitir({ estado: 'error', mensaje: e?.message ?? 'sin conexión' });
    }
  }

  async function instalarLinux() {
    if (!pendiente || instalando) return;
    instalando = true;
    const { nueva, url, archivo } = pendiente;
    try {
      emitir({ estado: 'descargando', nueva, progreso: 0 });
      await descargarEInstalar({
        fetch: net.fetch, nueva, url, archivo, arquitectura: process.arch,
        carpeta: path.join(app.getPath('temp'), 'quechimba-actualizacion'),
        alProgreso: (progreso) => emitir({ estado: progreso >= 100 ? 'instalando' : 'descargando', progreso }),
        ejecutar: async (prog, args) => { emitir({ estado: 'instalando', nueva }); await ejecutarSinConsola(prog, args); },
      });
      app.relaunch();
      app.exit(0);
    } catch (e) {
      instalando = false;
      emitir(e.necesitaClave
        ? { estado: 'manual', nueva, comandos: comandosManuales(url, archivo) }
        : { estado: 'error', mensaje: e?.message ?? 'No se pudo actualizar', comandos: comandosManuales(url, archivo) });
    }
  }

  ipcMain.handle('updater:estado', () => estado);
  ipcMain.handle('updater:buscar', async () => {
    if (!app.isPackaged) return estado;
    if (ES_LINUX) { await buscarLinux(); return estado; }
    try { await autoUpdater.checkForUpdates(); } catch (e) { emitir({ estado: 'error', mensaje: e.message }); }
    return estado;
  });
  ipcMain.handle('updater:instalar', () => {
    if (ES_LINUX) { if (['disponible', 'error'].includes(estado.estado)) instalarLinux(); return; }
    if (estado.estado === 'lista') autoUpdater.quitAndInstall(false, true);
  });

  // En desarrollo no hay nada que actualizar
  if (!app.isPackaged) return;

  if (ES_LINUX) {
    setTimeout(buscarLinux, 10_000);
    setInterval(buscarLinux, CADA_4_HORAS);
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => emitir({ estado: 'buscando' }));
  autoUpdater.on('update-available', (i) => emitir({ estado: 'descargando', nueva: i.version, progreso: 0 }));
  autoUpdater.on('update-not-available', () => emitir({ estado: 'al-dia' }));
  autoUpdater.on('download-progress', (p) => emitir({ estado: 'descargando', progreso: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (i) => emitir({ estado: 'lista', nueva: i.version }));
  autoUpdater.on('error', (e) => emitir({ estado: 'error', mensaje: e?.message ?? 'Error al actualizar' }));

  const buscar = () => autoUpdater.checkForUpdates().catch(() => {});
  setTimeout(buscar, 10_000);
  setInterval(buscar, CADA_4_HORAS);
}
