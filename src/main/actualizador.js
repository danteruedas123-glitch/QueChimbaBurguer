/**
 * Actualizaciones automáticas desde GitHub Releases (electron-updater).
 *  • Busca al abrir y cada 4 horas.
 *  • Descarga en segundo plano.
 *  • Se instala al CERRAR la app (nunca interrumpe el servicio), o cuando el
 *    encargado toca "Reiniciar y actualizar".
 */
import { app } from 'electron';
import updaterPkg from 'electron-updater';

const { autoUpdater } = updaterPkg;
const CADA_4_HORAS = 4 * 60 * 60 * 1000;

export function iniciarActualizador(ventana, ipcMain) {
  let estado = { estado: app.isPackaged ? 'inactivo' : 'desarrollo', version: app.getVersion() };
  const emitir = (nuevo) => {
    estado = { ...estado, ...nuevo };
    ventana()?.webContents.send('updater:estado', estado);
  };

  ipcMain.handle('updater:estado', () => estado);
  ipcMain.handle('updater:buscar', async () => {
    if (!app.isPackaged) return estado;
    try { await autoUpdater.checkForUpdates(); } catch (e) { emitir({ estado: 'error', mensaje: e.message }); }
    return estado;
  });
  ipcMain.handle('updater:instalar', () => {
    if (estado.estado === 'lista') autoUpdater.quitAndInstall(false, true);
  });

  // En desarrollo no hay nada que actualizar
  if (!app.isPackaged) return;

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
