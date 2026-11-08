/**
 * Genera, a partir de supabase/menu.mjs (la única fuente del menú):
 *   • supabase/seed.sql            → menú de instalaciones nuevas y del modo demo
 *   • supabase/actualizar_menu.sql → reemplaza el menú en Supabase de producción
 *   • WebQuechimbaburger/js/config.js (bloque MENÚ) → respaldo de la web sin conexión
 *   npm run menu:generar
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORIAS, DESTACADO, productosPlanos } from '../supabase/menu.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = process.env.QB_WEB_DIR ?? path.resolve(RAIZ, '..', 'WebQuechimbaburger');
const PRODUCTOS = productosPlanos();

const sql = (v) => (v === null || v === undefined ? 'null' : typeof v === 'number' || typeof v === 'boolean' ? String(v) : `'${String(v).replaceAll("'", "''")}'`);
const js = (v) => `'${String(v).replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;

const valoresCategorias = CATEGORIAS.map((c, i) => `  (${sql(c.slug)}, ${sql(c.nombre)}, ${i + 1})`).join(',\n');
const valoresProductos = PRODUCTOS.map((p) => `  (${[p.slug, p.categoria, p.nombre, p.descripcion, p.precio, p.etiqueta, p.foto_url, p.activo, p.orden].map(sql).join(', ')})`).join(',\n');
const listaSlugs = (xs) => xs.map((x) => sql(x.slug)).join(', ');
const destacado = `update public.ajustes set
  producto_destacado_id = (select id from public.productos where slug = ${sql(DESTACADO.producto)}),
  titulo_destacado      = ${sql(DESTACADO.titulo)},
  foto_destacado_url    = ${sql(DESTACADO.foto)}`;

// ---------- seed.sql ----------
const seed = `-- =====================================================================
-- Quechimba Burger · Menú real (instalación nueva y modo demo)
-- GENERADO desde supabase/menu.mjs con "npm run menu:generar". No editar aquí.
-- ${CATEGORIAS.length} categorías · ${PRODUCTOS.length} productos (${PRODUCTOS.filter((p) => !p.activo).length} ocultos hasta tener precio)
-- =====================================================================

insert into public.categorias (slug, nombre, orden) values
${valoresCategorias};

insert into public.productos (slug, categoria_id, nombre, descripcion, precio, etiqueta, foto_url, activo, orden)
select v.slug, c.id, v.nombre, v.descripcion, v.precio, v.etiqueta, v.foto_url, v.activo, v.orden
from (values
${valoresProductos}
) as v (slug, cat, nombre, descripcion, precio, etiqueta, foto_url, activo, orden)
join public.categorias c on c.slug = v.cat;

-- Producto destacado de la web y dirección del sitio (para ver las fotos desde la app)
${destacado},
  url_sitio             = 'https://raw.githubusercontent.com/danteruedas123-glitch/QueChimbaBurguer/web/'
where id = 1;
`;

// ---------- actualizar_menu.sql ----------
const actualizar = `-- =====================================================================
-- Quechimba Burger · REEMPLAZAR EL MENÚ POR EL MENÚ REAL
-- GENERADO desde supabase/menu.mjs con "npm run menu:generar". No editar aquí.
-- Pegar TODO en Supabase → SQL Editor → Run (una vez).
-- • Crea o actualiza las ${CATEGORIAS.length} categorías y los ${PRODUCTOS.length} productos del menú real.
-- • Los productos viejos que NUNCA se vendieron se borran; los que ya tienen
--   ventas se ocultan (la contabilidad histórica no cambia).
-- • Los jugos quedan ocultos y en $0: ponles precio y actívalos en la app (Menú).
-- • La web se actualiza sola en segundos (aviso en vivo de la migración 07).
-- =====================================================================
begin;

insert into public.categorias (slug, nombre, orden) values
${valoresCategorias}
on conflict (slug) do update set nombre = excluded.nombre, orden = excluded.orden, activa = true;

insert into public.productos (slug, categoria_id, nombre, descripcion, precio, etiqueta, foto_url, activo, orden)
select v.slug, c.id, v.nombre, v.descripcion, v.precio, v.etiqueta, v.foto_url, v.activo, v.orden
from (values
${valoresProductos}
) as v (slug, cat, nombre, descripcion, precio, etiqueta, foto_url, activo, orden)
join public.categorias c on c.slug = v.cat
on conflict (slug) do update set
  categoria_id = excluded.categoria_id, nombre = excluded.nombre, descripcion = excluded.descripcion,
  precio = excluded.precio, etiqueta = excluded.etiqueta, foto_url = excluded.foto_url,
  activo = excluded.activo, agotado = false, orden = excluded.orden;

-- Menú viejo: se borra lo que nunca se vendió y se oculta lo que sí
delete from public.productos p
where p.slug not in (${listaSlugs(PRODUCTOS)})
  and not exists (select 1 from public.pedido_items i where i.producto_id = p.id);
update public.productos set activo = false
where slug not in (${listaSlugs(PRODUCTOS)});
delete from public.categorias c
where c.slug not in (${listaSlugs(CATEGORIAS)})
  and not exists (select 1 from public.productos p where p.categoria_id = c.id);
update public.categorias set activa = false
where slug not in (${listaSlugs(CATEGORIAS)});

${destacado}
where id = 1;

commit;
`;

// ---------- web: bloque MENÚ de config.js ----------
const sangria = '    ';
const productoWeb = (p) => `${sangria}{ id: ${js(p.slug)}, categoria: ${js(p.categoria)}, nombre: ${js(p.nombre)}, precio: ${p.precio},${p.etiqueta ? ` etiqueta: ${js(p.etiqueta)},` : ''}
${sangria}  descripcion: ${js(p.descripcion)},
${sangria}  foto: ${js(p.foto_url ?? 'assets/img/logo.webp')} }`;
const bloqueWeb = `  /* >>> MENÚ · GENERADO desde QuechimbaPedidos/supabase/menu.mjs ("npm run menu:generar").
     No editar aquí: es solo el respaldo para cuando no hay conexión; el menú
     en vivo sale de la base de datos y el dueño lo cambia desde la app. */
  categorias: [
${CATEGORIAS.filter((c) => PRODUCTOS.some((p) => p.categoria === c.slug && p.activo)).map((c) => `${sangria}{ id: ${js(c.slug)}, nombre: ${js(c.nombre)} }`).join(',\n')}
  ],

  productos: [
${PRODUCTOS.filter((p) => p.activo).map(productoWeb).join(',\n')}
  ],

  /* Franja promocional: producto destacado, su foto grande y el título pequeño */
  promo: {
    producto: ${js(DESTACADO.producto)},
    foto: ${js(DESTACADO.foto)},
    titulo: ${js(DESTACADO.titulo)}
  }
  /* <<< MENÚ */`;

const rutaConfig = path.join(WEB, 'js', 'config.js');
let config = await readFile(rutaConfig, 'utf8');
const ini = config.indexOf('  /* >>> MENÚ');
const fin = config.indexOf('/* <<< MENÚ */');
if (ini < 0 || fin < 0) throw new Error('No encontré el bloque MENÚ en config.js');
config = config.slice(0, ini) + bloqueWeb + config.slice(fin + '/* <<< MENÚ */'.length);

await writeFile(path.join(RAIZ, 'supabase', 'seed.sql'), seed);
await writeFile(path.join(RAIZ, 'supabase', 'actualizar_menu.sql'), actualizar);
await writeFile(rutaConfig, config);
console.log(`Menú generado: ${CATEGORIAS.length} categorías, ${PRODUCTOS.length} productos (${PRODUCTOS.filter((p) => !p.activo).length} ocultos).`);
