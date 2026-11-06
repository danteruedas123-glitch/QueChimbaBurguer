/**
 * Ubicación de archivos de terceros que la interfaz necesita.
 * (Sin dependencias de Electron para poder probarlo con node:test.)
 */
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);

/**
 * Ruta del bundle UMD de supabase-js. Según la versión, el punto de entrada
 * está en dist/ o en dist/main/, así que se prueban ambas ubicaciones.
 */
export function rutaSupabaseUMD() {
  const entrada = path.dirname(require.resolve('@supabase/supabase-js'));
  const candidatas = [
    path.join(entrada, 'umd', 'supabase.js'),
    path.join(entrada, '..', 'umd', 'supabase.js'),
    path.join(entrada, '..', 'dist', 'umd', 'supabase.js'),
  ];
  const ruta = candidatas.find((c) => existsSync(c));
  if (!ruta) throw new Error(`No se encontró supabase.js (UMD). Revisado: ${candidatas.join(' | ')}`);
  return ruta;
}
