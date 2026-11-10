/**
 * Actualizaciones automáticas.
 *  • Windows: desde GitHub Releases con electron-updater. Busca al abrir y
 *    cada 4 horas, descarga en segundo plano y se instala al CERRAR la app
 *    (nunca interrumpe el servicio) o con "Reiniciar y actualizar".
 *  • Linux (Chromebook): el sistema no deja que la app se reinstale sola; se
 *    avisa que hay versión nueva y el botón descarga el instalador .deb.
 */
import { app, net, shell } from 'electron';
import updaterPkg from 'electron-updater';
import { URL_ULTIMA, revisarPublicacion } from './version-linux.js';

const { autoUpdater } = updaterPkg;
const CADA_4_HORAS = 4 * 60 * 60 * 1000;
const ES_LINUX = process.platform === 'linux';

export function iniciarActualizador(ventana, ipcMain) {
  let estado = { estado: app.isPackaged ? 'inactivo' : 'desarrollo', version: app.getVersion(), plataforma: process.platform };
  let urlDescarga = null;
  const emitir = (nuevo) => {
    estado = { ...estado, ...nuevo };
    ventana()?.webContents.send('updater:estado', estado);
  };

  async function buscarLinux() {
    emitir({ estado: 'buscando' });
    try {
      const r = await net.fetch(URL_ULTIMA, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'quechimba-pedidos' } });
      if (!r.ok) throw new Error(`GitHub respondió ${r.status}`);
      const info = revisarPublicacion(await r.json(), app.getVersion(), process.arch);
      urlDescarga = info.url ?? null;
      emitir(info.estado === 'disponible' ? { estado: 'disponible', nueva: info.nueva } : info);
    } catch (e) {
      emitir({ estado: 'error', mensaje: e?.message ?? 'sin conexión' });
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
    if (ES_LINUX) { if (estado.estado === 'disponible' && urlDescarga) shell.openExternal(urlDescarga); return; }
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
