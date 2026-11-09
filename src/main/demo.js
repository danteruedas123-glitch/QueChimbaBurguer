/**
 * MODO DEMO: la app completa funcionando sin Supabase.
 * Usa PostgreSQL local (PGlite) con las MISMAS migraciones y reglas de
 * seguridad que producción, y genera 45 días de ventas de ejemplo.
 *   Usuario: demo@quechimba.co   Contraseña: demo1234
 */
import { crearBaseLocal } from './db-local.js';

export const CREDENCIALES_DEMO = { email: 'demo@quechimba.co', password: 'demo1234' };

// Funciones que la interfaz puede invocar (mismas que expone Supabase)
const PERMITIDAS = new Set([
  'menu_publico', 'app_info', 'perfil_actual', 'menu_admin', 'categoria_guardar', 'categoria_eliminar',
  'producto_guardar', 'producto_eliminar', 'ajustes_guardar', 'pedidos_listar', 'pedido_cambiar_estado',
  'pedido_actualizar_cobro', 'venta_registrar', 'reporte_ventas', 'crear_pedido_web',
]);
const MODIFICAN_PEDIDOS = new Set(['crear_pedido_web', 'venta_registrar', 'pedido_cambiar_estado', 'pedido_actualizar_cobro']);

const HISTORIAL_SQL = `
do $$
declare
  v_hoy   date := (now() at time zone 'America/Bogota')::date;
  v_prods uuid[];
  v_id    uuid;
  v_ts    timestamptz;
  v_prod  public.productos%rowtype;
  v_ent   public.tipo_entrega;
  v_idx   int;
  r       float;
  nombres text[] := array['Andrea','Camilo','Daniela','Jorge','Luisa','Mateo','Paola','Sebastián','Valentina','Yesid'];
begin
  select array_agg(id) into v_prods from public.productos where activo and precio > 0;
  for d in 0..44 loop
    for i in 1..(8 + floor(random() * 13)::int) loop
      v_ts := (v_hoy - d)::timestamp at time zone 'America/Bogota' + interval '11 hours' + random() * interval '12 hours';
      continue when v_ts > now();
      v_ent := (array['domicilio','recoger','en_local'])[1 + floor(random() * 3)::int]::public.tipo_entrega;
      insert into public.pedidos (canal, tipo_entrega, metodo_pago, costo_domicilio, creado_en, cliente_nombre, direccion)
      values (
        (array['web','whatsapp','local','local'])[1 + floor(random() * 4)::int]::public.canal_pedido,
        v_ent,
        (array['efectivo','efectivo','efectivo','transferencia','transferencia','transferencia'])[1 + floor(random() * 6)::int]::public.metodo_pago,
        case when v_ent = 'domicilio' then (array[3000,4000,5000])[1 + floor(random() * 3)::int] else 0 end,
        v_ts,
        nombres[1 + floor(random() * 10)::int],
        case when v_ent = 'domicilio' then 'Barrio La Florencia, casa ' || (1 + floor(random() * 90)::int) else '' end
      ) returning id into v_id;

      for k in 1..(1 + floor(random() * 3)::int) loop
        -- El índice se calcula ANTES: random() dentro de un WHERE se evalúa por cada fila
        v_idx := 1 + floor(random() * array_length(v_prods, 1))::int;
        select * into strict v_prod from public.productos where id = v_prods[v_idx];
        insert into public.pedido_items (pedido_id, producto_id, nombre_producto, categoria_nombre, precio_unitario, cantidad)
        values (v_id, v_prod.id, v_prod.nombre, (select nombre from public.categorias where id = v_prod.categoria_id),
                v_prod.precio, 1 + floor(random() * 3)::int);
      end loop;

      r := random();
      if d = 0 and r < 0.30 then
        update public.pedidos set estado = (array['nuevo','preparando','listo'])[1 + floor(random() * 3)::int]::public.estado_pedido
        where id = v_id and random() > 0.33;
      elsif r < 0.94 then
        update public.pedidos set estado = 'entregado' where id = v_id;
      else
        update public.pedidos set estado = 'cancelado', motivo_cancelacion = 'Cliente canceló' where id = v_id;
      end if;
    end loop;
  end loop;
end
$$;`;

export async function crearBaseDemo({ conHistorial = true } = {}) {
  const base = await crearBaseLocal();
  await base.crearUsuario(CREDENCIALES_DEMO.email, CREDENCIALES_DEMO.password, { nombre: 'Encargado (demo)', rol: 'admin' });
  if (conHistorial) await base.db.exec(HISTORIAL_SQL);
  return base;
}

export async function registrarDemo(ipcMain, ventana) {
  const base = await crearBaseDemo({ conHistorial: process.env.QB_DEMO_VACIO !== '1' });
  let sesion = null;

  const avisarCambio = () => ventana()?.webContents.send('demo:cambio-pedidos');
  // Los errores cruzan IPC como datos (Electron pierde las propiedades de Error)
  const responder = async (fn) => {
    try {
      return { datos: await fn() };
    } catch (e) {
      return { error: { message: e.message, hint: e.hint ?? null, code: e.code ?? null } };
    }
  };

  ipcMain.handle('demo:login', (_e, { email, password } = {}) => responder(async () => {
    const [u] = await base.sql(`select id, email from auth.users where email = lower(btrim($1)) and contrasena = $2`,
      [String(email ?? ''), String(password ?? '')], { rol: 'postgres' });
    if (!u) throw new Error('Invalid login credentials');
    sesion = u;
    return u;
  }));
  ipcMain.handle('demo:logout', () => { sesion = null; });
  ipcMain.handle('demo:sesion', () => sesion);

  ipcMain.handle('demo:rpc', (_e, { nombre, args } = {}) => responder(async () => {
    if (!PERMITIDAS.has(nombre)) throw new Error('Función no permitida');
    const opciones = sesion ? { rol: 'authenticated', usuario: sesion.id } : { rol: 'anon' };
    const r = await base.rpc(nombre, args ?? {}, opciones);
    if (MODIFICAN_PEDIDOS.has(nombre)) avisarCambio();
    return r;
  }));

  // Simula un cliente pidiendo desde la página web (para probar las alertas)
  ipcMain.handle('demo:simular-pedido-web', () => responder(async () => {
    const menu = await base.rpc('menu_publico', {}, { rol: 'anon' });
    const disponibles = menu.productos.filter((p) => !p.agotado);
    const azar = (xs) => xs[Math.floor(Math.random() * xs.length)];
    // Un cliente también elige las opciones (bebida del combo, en agua o en leche…)
    const linea = (cantidad) => {
      const p = azar(disponibles);
      const opciones = (p.opciones ?? []).map((g) => Array.from({ length: g.elige }, () => azar(g.lista ? menu.bebidas[g.lista] : g.opciones.map((o) => o.nombre))));
      return opciones.length ? { slug: p.slug, cantidad, opciones } : { slug: p.slug, cantidad };
    };
    const nombres = ['Laura Gómez', 'Andrés Ríos', 'Katherine Díaz', 'Felipe Mejía'];
    const r = await base.rpc('crear_pedido_web', {
      p_items: [linea(1 + Math.floor(Math.random() * 2)), linea(1)],
      p_cliente: {
        nombre: nombres[Math.floor(Math.random() * nombres.length)], telefono: '304 000 0000',
        tipo_entrega: 'domicilio', direccion: 'Barrio La Florencia, Calle 5 # 3-20', metodo_pago: 'transferencia', notas: 'Sin cebolla',
      },
    }, { rol: 'anon' });
    avisarCambio();
    return r;
  }));
}
