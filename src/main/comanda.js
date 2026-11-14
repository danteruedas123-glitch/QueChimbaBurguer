/**
 * Imprime la comanda de un pedido.
 *  • Se arma en una ventana oculta y sin acceso al sistema (igual que el PDF).
 *  • Abre el cuadro de impresión del sistema: ahí se elige la impresora de
 *    tickets (o cualquier otra) y la próxima vez queda recordada.
 *  • El tamaño de la hoja es el de la comanda (80 o 58 mm de ancho y el alto
 *    justo), para que la impresora de tickets no gaste papel de más.
 */
import { BrowserWindow } from 'electron';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PRELOAD = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'preload', 'preload-reporte.cjs');
const MICRAS_POR_PX = 25400 / 96; // 96 px por pulgada

/** Solo se aceptan los datos que la comanda usa, con el tipo correcto. */
export function limpiarPedido(p) {
  if (!p || typeof p !== 'object' || !Number.isInteger(p.numero) || !Array.isArray(p.items) || !p.items.length) return null;
  const texto = (x, max = 240) => (typeof x === 'string' ? x.slice(0, max) : '');
  const entero = (x) => (Number.isInteger(x) ? x : 0);
  return {
    numero: p.numero, canal: texto(p.canal, 20), tipo_entrega: texto(p.tipo_entrega, 20), metodo_pago: texto(p.metodo_pago, 20),
    creado_en: texto(p.creado_en, 40) || new Date().toISOString(),
    cliente_nombre: texto(p.cliente_nombre, 60), cliente_telefono: texto(p.cliente_telefono, 20), direccion: texto(p.direccion, 140), notas: texto(p.notas),
    subtotal: entero(p.subtotal), costo_domicilio: entero(p.costo_domicilio), descuento: entero(p.descuento), total: entero(p.total),
    items: p.items.slice(0, 60).map((i) => ({ nombre: texto(i?.nombre, 60), detalle: texto(i?.detalle, 300), cantidad: entero(i?.cantidad), subtotal: entero(i?.subtotal) })),
  };
}

export async function imprimirComanda(datos, origen) {
  const pedido = limpiarPedido(datos?.pedido);
  if (!pedido) return { error: 'No hay datos del pedido para imprimir' };
  const ancho = datos?.ancho === 58 ? 58 : 80;

  const win = new BrowserWindow({
    show: false,
    width: ancho === 58 ? 220 : 300,
    height: 1200,
    webPreferences: { preload: PRELOAD, contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  try {
    await win.loadURL(`${origen}/renderer/comanda/comanda.html`);
    const altoPx = await win.webContents.executeJavaScript(`window.pintarComanda(${JSON.stringify({ pedido, ancho })})`);
    const pageSize = { width: ancho * 1000, height: Math.max(80_000, Math.ceil(altoPx * MICRAS_POR_PX) + 8_000) };

    // Pruebas automáticas: se guarda como PDF en lugar de abrir el cuadro de impresión
    if (process.env.QB_E2E_PDF) {
      const pdf = await win.webContents.printToPDF({ pageSize: { width: pageSize.width / 25400, height: pageSize.height / 25400 }, margins: { marginType: 'none' } });
      const ruta = path.join(process.env.QB_E2E_PDF, `Comanda_${pedido.numero}.pdf`);
      await writeFile(ruta, pdf);
      return { ok: true, ruta };
    }

    return await new Promise((resolver) => {
      win.webContents.print(
        { silent: false, printBackground: false, margins: { marginType: 'none' }, pageSize },
        (ok, motivo) => resolver(ok ? { ok: true } : /cancel/i.test(motivo ?? '') ? { cancelado: true } : { error: `No se pudo imprimir: ${motivo || 'impresora no disponible'}` }),
      );
    });
  } catch (e) {
    return { error: `No se pudo preparar la comanda: ${e.message}` };
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}
