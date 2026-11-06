/**
 * Genera el PDF de contabilidad con el motor de Chromium (printToPDF):
 * se ve exactamente igual al diseño de la app y no necesita librerías extra.
 */
import { BrowserWindow, dialog, app } from 'electron';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PRELOAD = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'preload', 'preload-reporte.cjs');

export async function generarPDF(ventanaPadre, datos, origen) {
  if (!datos?.reporte?.resumen) return { error: 'No hay datos para el reporte' };

  const win = new BrowserWindow({
    show: false,
    width: 900,
    height: 1200,
    webPreferences: { preload: PRELOAD, contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  try {
    await win.loadURL(`${origen}/renderer/reporte/reporte.html`);
    await win.webContents.executeJavaScript(`window.pintarReporte(${JSON.stringify(datos)})`);
    const pdf = await win.webContents.printToPDF({
      pageSize: 'Letter',
      printBackground: true,
      margins: { top: 0.4, bottom: 0.5, left: 0.4, right: 0.4 },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="width:100%;font:8px Arial;color:#6d6158;padding:0 28px;display:flex;justify-content:space-between">
        <span>Quechimba Burger · Reporte de ventas</span>
        <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>`,
    });

    const nombre = `Contabilidad_Quechimba_${datos.reporte.desde}${datos.reporte.desde === datos.reporte.hasta ? '' : `_a_${datos.reporte.hasta}`}.pdf`;
    let destino = process.env.QB_E2E_PDF ? path.join(process.env.QB_E2E_PDF, nombre) : null;
    if (!destino) {
      const r = await dialog.showSaveDialog(ventanaPadre, {
        title: 'Guardar reporte de contabilidad',
        defaultPath: path.join(app.getPath('documents'), nombre),
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });
      if (r.canceled || !r.filePath) return { cancelado: true };
      destino = r.filePath;
    }
    await writeFile(destino, pdf);
    return { ruta: destino, bytes: pdf.length };
  } finally {
    win.destroy();
  }
}
