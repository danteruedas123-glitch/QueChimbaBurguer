/**
 * Pruebas de MUTACIÓN: introduce errores a propósito en una copia del SQL
 * y verifica que las pruebas los detecten. Si alguna mutación "sobrevive",
 * significa que a las pruebas les falta cobertura.
 *   Uso: node tests/mutacion.mjs
 */
import { cp, readFile, writeFile, rm, mkdtemp } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIG = 'migrations';

const MUTACIONES = [
  ['reporte usa la hora UTC en vez de la de Colombia', '20261106000005_reportes.sql', "(creado_en at time zone p_tz)::date", "(creado_en at time zone 'UTC')::date"],
  ['reporte excluye el último día del rango', '20261106000005_reportes.sql', 'v_fin := (p_hasta + 1)::timestamp', 'v_fin := (p_hasta)::timestamp'],
  ['reporte cuenta pedidos pendientes como ventas', '20261106000005_reportes.sql', "select * from base where estado = 'entregado'", "select * from base where estado <> 'cancelado'"],
  ['reporte ignora descuentos en el total por método', '20261106000005_reportes.sql', 'select metodo_pago as metodo, count(*) as pedidos, sum(total) as total', 'select metodo_pago as metodo, count(*) as pedidos, sum(subtotal + costo_domicilio) as total'],
  ['ticket promedio trunca en vez de redondear', '20261106000005_reportes.sql', 'round(sum(total)::numeric / count(*))::bigint', 'trunc(sum(total)::numeric / count(*))::bigint'],
  ['pedido web acepta el precio enviado por el cliente', '20261109000012_limites_dinero.sql', "v_prod.precio + (v_linea ->> 'extra')::int, v_cant,", "coalesce((p_lineas -> 0 ->> 'precio')::int, v_prod.precio + (v_linea ->> 'extra')::int), v_cant,"],
  ['pedido web acepta productos agotados', '20261109000012_limites_dinero.sql', 'if p_solo_disponibles and (not v_prod.activo or v_prod.agotado) then', 'if p_solo_disponibles and (not v_prod.activo) then'],
  ['el extra de una opción (ej. en leche) no se cobra', '20261109000012_limites_dinero.sql', "v_prod.precio + (v_linea ->> 'extra')::int", 'v_prod.precio'],
  ['se acepta una bebida que no está en la lista', '20261108000010_opciones.sql', 'if not v_validas ? v_nombre then', 'if false then'],
  ['se permite volver de cancelado', '20261106000002_integridad.sql', "when p_desde = 'cancelado' then false", "when p_desde = 'cancelado' then true"],
  ['anular entregado sin motivo', '20261106000002_integridad.sql', "if old.estado = 'entregado' and char_length(btrim(coalesce(new.motivo_cancelacion, ''))) < 3 then", 'if false then'],
  ['el personal puede escribir directo en productos', '20261106000003_seguridad.sql', 'grant select on public.staff,', 'grant select, update on public.productos to authenticated;\ngrant select on public.staff,'],
  ['intrusos autenticados ven los pedidos', '20261106000003_seguridad.sql', 'create policy staff_lee_pedidos    on public.pedidos        for select to authenticated using (public.es_staff());', 'create policy staff_lee_pedidos    on public.pedidos        for select to authenticated using (true);'],
  ['funciones de personal sin verificar permiso', '20261106000004_funciones.sql', "if not public.es_staff() then\n    raise exception 'No tienes permiso", "if false then\n    raise exception 'No tienes permiso"],
];

let sobrevivientes = 0;
for (const [nombre, archivo, original, mutado] of MUTACIONES) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'qb-mut-'));
  await cp(path.join(RAIZ, 'supabase'), dir, { recursive: true });
  const ruta = path.join(dir, MIG, archivo);
  // Normalizar fines de línea: en Windows (GitHub Actions) los archivos pueden venir con CRLF
  const sql = (await readFile(ruta, 'utf8')).replace(/\r\n/g, '\n');
  if (!sql.includes(original)) throw new Error(`No se encontró el texto a mutar en ${archivo}: ${nombre}`);
  await writeFile(ruta, sql.replace(original, mutado));

  const r = spawnSync(process.execPath, ['--test', '--test-concurrency=1', 'tests/db/'], {
    cwd: RAIZ, env: { ...process.env, QB_DIR_SUPABASE: dir }, encoding: 'utf8',
  });
  const fallos = Number((r.stdout.match(/ℹ fail (\d+)/) ?? [])[1] ?? 0);
  const detectada = r.status !== 0;
  if (!detectada) sobrevivientes++;
  console.log(`${detectada ? '✔ detectada ' : '✖ SOBREVIVIÓ'}  ${nombre}${detectada ? `  (${fallos} pruebas fallaron)` : ''}`);
  await rm(dir, { recursive: true, force: true });
}
console.log(`\n${MUTACIONES.length - sobrevivientes}/${MUTACIONES.length} mutaciones detectadas`);
process.exit(sobrevivientes ? 1 : 0);
