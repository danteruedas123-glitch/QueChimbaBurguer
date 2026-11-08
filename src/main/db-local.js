/**
 * Base de datos local (PGlite = PostgreSQL real compilado a WebAssembly).
 *
 * Reproduce lo necesario del entorno de Supabase (roles anon/authenticated,
 * esquema auth, auth.uid()) y ejecuta LAS MISMAS migraciones que producción.
 * Se usa en:
 *   • las pruebas automáticas (tests/db), y
 *   • el "modo demo" de la app, para probarla sin crear el proyecto en Supabase.
 */
import { PGlite } from '@electric-sql/pglite';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// QB_DIR_SUPABASE permite apuntar a otra copia (usado por las pruebas de mutación)
export const DIR_SUPABASE = process.env.QB_DIR_SUPABASE || path.join(RAIZ, 'supabase');

// Entorno mínimo que Supabase ya trae creado en producción
const ENTORNO_SUPABASE = `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;
  grant usage on schema public to anon, authenticated, service_role;

  create schema auth;
  grant usage on schema auth to anon, authenticated;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique not null,
    contrasena text not null default ''
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant execute on function auth.uid() to anon, authenticated;
`;

export class ErrorBD extends Error {
  constructor(error) {
    super(error.message);
    this.name = 'ErrorBD';
    this.code = error.code;
    this.hint = error.hint ?? null;
  }
}

/** Crea la base, aplica migraciones y (opcional) los datos iniciales. */
/** Base vacía con el entorno de Supabase, sin migraciones (para probar el instalador unificado). */
export async function crearBaseVacia() {
  const db = new PGlite();
  await db.exec(ENTORNO_SUPABASE);
  return new BaseLocal(db);
}

export async function crearBaseLocal({ conSemilla = true, semilla = path.join(DIR_SUPABASE, 'seed.sql') } = {}) {
  const db = new PGlite();
  await db.exec(ENTORNO_SUPABASE);

  const dirMig = path.join(DIR_SUPABASE, 'migrations');
  const archivos = (await readdir(dirMig)).filter((f) => f.endsWith('.sql')).sort();
  for (const archivo of archivos) {
    try {
      await db.exec(await readFile(path.join(dirMig, archivo), 'utf8'));
    } catch (e) {
      throw new Error(`Migración ${archivo} falló: ${e.message}`);
    }
  }
  if (conSemilla) {
    await db.exec(await readFile(semilla, 'utf8'));
  }
  return new BaseLocal(db);
}

export class BaseLocal {
  constructor(db) {
    this.db = db;
    this.firmas = null; // nombre de función → [{ nombre, tipo }]
  }

  /** Ejecuta fn dentro de una transacción con el rol y usuario indicados (como lo hace Supabase). */
  async como({ rol = 'anon', usuario = null } = {}, fn) {
    if (!['anon', 'authenticated', 'service_role', 'postgres'].includes(rol)) throw new Error('Rol inválido');
    try {
      return await this.db.transaction(async (tx) => {
        if (rol !== 'postgres') await tx.exec(`set local role ${rol}`);
        await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [usuario ?? '']);
        return await fn(tx);
      });
    } catch (e) {
      throw e instanceof ErrorBD ? e : new ErrorBD(e);
    }
  }

  /** Consulta SQL directa (sólo pruebas). */
  async sql(texto, params = [], opciones = {}) {
    return this.como(opciones, async (tx) => (await tx.query(texto, params)).rows);
  }

  async cargarFirmas() {
    const filas = (await this.db.query(`
      select p.proname as nombre,
             coalesce(p.proargnames, '{}') as args,
             array(select format_type(t, null) from unnest(p.proargtypes) as t) as tipos
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname !~ '^(_|tg_)'
    `)).rows;
    this.firmas = Object.fromEntries(filas.map((f) => [
      f.nombre, f.args.map((a, i) => ({ nombre: a, tipo: f.tipos[i] })),
    ]));
  }

  /**
   * Llama una función como lo haría supabase.rpc(nombre, args).
   * Los argumentos se pasan por nombre; los que falten usan su valor por defecto.
   */
  async rpc(nombre, args = {}, opciones = {}) {
    if (!this.firmas) await this.cargarFirmas();
    const firma = this.firmas[nombre];
    if (!firma) throw new ErrorBD({ message: `La función ${nombre} no existe`, code: '42883' });

    const partes = [];
    const valores = [];
    for (const { nombre: arg, tipo } of firma) {
      if (!(arg in args)) continue;
      const v = args[arg];
      valores.push(serializar(v, tipo));
      partes.push(`${arg} => $${valores.length}::${tipo}`);
    }
    const desconocidos = Object.keys(args).filter((a) => !firma.some((f) => f.nombre === a));
    if (desconocidos.length) throw new ErrorBD({ message: `Argumentos desconocidos: ${desconocidos.join(', ')}`, code: '42883' });

    const filas = await this.como(opciones, async (tx) =>
      (await tx.query(`select public.${nombre}(${partes.join(', ')}) as r`, valores)).rows);
    return filas[0]?.r ?? null;
  }

  async crearUsuario(email, contrasena, staff = null) {
    const [u] = await this.sql(`insert into auth.users (email, contrasena) values ($1, $2) returning id`,
      [email, contrasena], { rol: 'postgres' });
    if (staff) {
      await this.sql(`insert into public.staff (user_id, nombre, rol) values ($1, $2, $3)`,
        [u.id, staff.nombre, staff.rol ?? 'encargado'], { rol: 'postgres' });
    }
    return u.id;
  }

  async cerrar() {
    await this.db.close();
  }
}

function serializar(valor, tipo) {
  if (valor === null || valor === undefined) return null;
  if (tipo === 'jsonb' || tipo === 'json') return JSON.stringify(valor);
  if (tipo.endsWith('[]')) {
    if (!Array.isArray(valor)) throw new ErrorBD({ message: 'Se esperaba una lista', code: '22P02' });
    return `{${valor.map((x) => `"${String(x).replace(/["\\]/g, '\\$&')}"`).join(',')}}`;
  }
  return String(valor);
}
