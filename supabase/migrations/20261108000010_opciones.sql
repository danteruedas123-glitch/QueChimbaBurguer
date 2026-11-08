-- =====================================================================
-- Quechimba Burger · 10 · Opciones al pedir (bebida del combo, en agua o
-- en leche, nivel de la michelada, con o sin papas…)
-- • productos.opciones: grupos de opciones del producto, por ejemplo
--     [{ "titulo": "Preparación", "elige": 1,
--        "opciones": [{ "nombre": "En agua", "extra": 0 }, { "nombre": "En leche", "extra": 2000 }] },
--      { "titulo": "Gaseosas", "elige": 2, "lista": "gaseosas" }]
--   "lista" toma las opciones de Ajustes (gaseosas o bebidas para michelada),
--   así el dueño cambia las bebidas disponibles en un solo lugar.
-- • El cliente solo envía QUÉ eligió; el precio (base + extras) lo calcula
--   SIEMPRE el servidor.
-- • pedido_items.detalle guarda lo elegido ("Gaseosas: Coca-Cola, Pepsi")
--   para la cocina, WhatsApp y el historial.
-- Segura de ejecutar más de una vez.
-- =====================================================================

-- ---------- Validación de la estructura de opciones ----------
create or replace function public._opciones_validas(p jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  g jsonb;
  o jsonb;
  v_nombres text[];
begin
  if p is null or jsonb_typeof(p) <> 'array' or jsonb_array_length(p) > 6 then return false; end if;
  for g in select * from jsonb_array_elements(p) loop
    if jsonb_typeof(g) <> 'object'
       or jsonb_typeof(g -> 'titulo') <> 'string' or char_length(btrim(g ->> 'titulo')) not between 1 and 30
       or jsonb_typeof(g -> 'elige') <> 'number' or (g ->> 'elige')::numeric not in (1, 2, 3, 4, 5) then
      return false;
    end if;
    if g ? 'lista' then
      if (g ->> 'lista') not in ('gaseosas', 'bebidas_michelada') or g ? 'opciones' then return false; end if;
    else
      if jsonb_typeof(g -> 'opciones') <> 'array' or jsonb_array_length(g -> 'opciones') not between 2 and 20 then return false; end if;
      v_nombres := '{}';
      for o in select * from jsonb_array_elements(g -> 'opciones') loop
        if jsonb_typeof(o) <> 'object'
           or jsonb_typeof(o -> 'nombre') <> 'string' or char_length(btrim(o ->> 'nombre')) not between 1 and 40
           or jsonb_typeof(o -> 'extra') <> 'number' or (o ->> 'extra')::numeric <> trunc((o ->> 'extra')::numeric)
           or (o ->> 'extra')::numeric not between 0 and 1000000
           or (o ->> 'nombre') = any (v_nombres) then
          return false;
        end if;
        v_nombres := v_nombres || (o ->> 'nombre');
      end loop;
    end if;
  end loop;
  return true;
end
$$;

-- Lista de bebidas válida: 1 a 30 nombres distintos de 1 a 40 caracteres
create or replace function public._lista_bebidas_valida(p text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p is not null and cardinality(p) between 1 and 30
     and (select count(distinct x) from unnest(p) x) = cardinality(p)
     and not exists (select 1 from unnest(p) x where x is null or char_length(btrim(x)) not between 1 and 40)
$$;

alter table public.productos add column if not exists opciones jsonb not null default '[]'::jsonb;
alter table public.productos drop constraint if exists productos_opciones_validas;
alter table public.productos add constraint productos_opciones_validas check (public._opciones_validas(opciones));

alter table public.pedido_items add column if not exists detalle text;
alter table public.pedido_items drop constraint if exists pedido_items_detalle_largo;
alter table public.pedido_items add constraint pedido_items_detalle_largo check (detalle is null or char_length(detalle) <= 300);

alter table public.ajustes add column if not exists bebidas_gaseosa text[] not null
  default array['Coca-Cola', 'Coca-Cola Zero', 'Postobón Manzana', 'Postobón Colombiana', 'Pepsi', 'Ginger'];
alter table public.ajustes add column if not exists bebidas_michelada text[] not null
  default array['Ginger', 'Bretaña', 'Soda Hatsu', 'Bretaña Hard Seltzer', 'Like', 'Cuates', 'Smirnoff', 'Club Colombia',
                'Coronita', 'Miller Lite', 'Águila', 'Budweiser', 'Heineken', 'Cola y Pola', 'Póker'];
alter table public.ajustes drop constraint if exists ajustes_bebidas_validas;
alter table public.ajustes add constraint ajustes_bebidas_validas
  check (public._lista_bebidas_valida(bebidas_gaseosa) and public._lista_bebidas_valida(bebidas_michelada));

-- ---------- Aplica lo que eligió el cliente: devuelve el extra por unidad y el detalle ----------
-- p_elegidas: un arreglo por grupo, en el mismo orden: [["En leche"], ["Coca-Cola", "Pepsi"]]
create or replace function public._aplicar_opciones(p_prod public.productos, p_elegidas jsonb, out extra int, out detalle text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_grupos jsonb := coalesce(p_prod.opciones, '[]'::jsonb);
  v_grupo  jsonb;
  v_elige  jsonb;
  v_nombre text;
  v_validas jsonb;
  v_partes text[] := '{}';
  v_i      int := 0;
  v_opcion jsonb;
begin
  extra := 0;
  detalle := null;
  if jsonb_array_length(v_grupos) = 0 then
    if p_elegidas is not null and jsonb_typeof(p_elegidas) = 'array' and jsonb_array_length(p_elegidas) > 0 then
      perform public._error('DATO_INVALIDO', format('"%s" no tiene opciones para elegir', p_prod.nombre));
    end if;
    return;
  end if;
  if p_elegidas is null or jsonb_typeof(p_elegidas) <> 'array' or jsonb_array_length(p_elegidas) <> jsonb_array_length(v_grupos) then
    perform public._error('OPCIONES_INCOMPLETAS', format('Elige las opciones de "%s"', p_prod.nombre));
  end if;

  for v_grupo in select * from jsonb_array_elements(v_grupos) loop
    v_elige := p_elegidas -> v_i;
    if jsonb_typeof(v_elige) <> 'array' or jsonb_array_length(v_elige) <> (v_grupo ->> 'elige')::int then
      perform public._error('OPCIONES_INCOMPLETAS', format('En "%s" elige %s de %s', p_prod.nombre, v_grupo ->> 'elige', lower(v_grupo ->> 'titulo')));
    end if;
    v_validas := case v_grupo ->> 'lista'
      when 'gaseosas' then (select to_jsonb(bebidas_gaseosa) from public.ajustes where id = 1)
      when 'bebidas_michelada' then (select to_jsonb(bebidas_michelada) from public.ajustes where id = 1)
      else (select jsonb_agg(o ->> 'nombre') from jsonb_array_elements(v_grupo -> 'opciones') o)
    end;
    for v_nombre in select x from jsonb_array_elements_text(v_elige) x loop
      if not v_validas ? v_nombre then
        perform public._error('OPCION_NO_EXISTE', format('"%s" ya no está disponible para "%s"', v_nombre, p_prod.nombre));
      end if;
      select o into v_opcion from jsonb_array_elements(v_grupo -> 'opciones') o where o ->> 'nombre' = v_nombre;
      extra := extra + coalesce((v_opcion ->> 'extra')::int, 0);
      v_opcion := null;
    end loop;
    v_partes := v_partes || format('%s: %s', v_grupo ->> 'titulo', (select string_agg(x, ', ') from jsonb_array_elements_text(v_elige) x));
    v_i := v_i + 1;
  end loop;
  detalle := left(array_to_string(v_partes, ' · '), 300);
end
$$;
revoke all on function public._aplicar_opciones(public.productos, jsonb) from public, anon, authenticated;
revoke all on function public._opciones_validas(jsonb) from public, anon, authenticated;
revoke all on function public._lista_bebidas_valida(text[]) from public, anon, authenticated;

-- ---------- Ítems del pedido con opciones ----------
-- p_lineas: [{ "slug": "...", "cantidad": 2, "opciones": [["Coca-Cola", "Pepsi"]] }]
-- • Web (p_solo_disponibles): las opciones son obligatorias en los productos que las tienen.
-- • Caja (personal): si no se envían opciones se registra el precio base sin detalle
--   (versiones anteriores de la app); si se envían, se validan igual que en la web.
-- Las líneas del mismo producto CON LO MISMO ELEGIDO se suman.
create or replace function public._insertar_items(p_pedido uuid, p_lineas jsonb, p_solo_disponibles boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_linea jsonb;
  v_cant  int;
  v_prod  public.productos%rowtype;
  v_cat   text;
  v_extra int;
  v_det   text;
  v_mapa  jsonb := '{}'::jsonb;   -- "producto_id|detalle" → { cantidad, extra, detalle }
  v_clave text;
begin
  if p_lineas is null or jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    perform public._error('PEDIDO_VACIO', 'El pedido no tiene productos');
  end if;
  if jsonb_array_length(p_lineas) > 40 then
    perform public._error('DATO_INVALIDO', 'El pedido tiene demasiados productos distintos');
  end if;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    if jsonb_typeof(v_linea) <> 'object' then
      perform public._error('DATO_INVALIDO', 'Formato de producto inválido');
    end if;
    v_cant := public._entero(v_linea, 'cantidad', 1, 99);

    if v_linea ? 'producto_id' then
      begin
        select * into v_prod from public.productos where id = (v_linea ->> 'producto_id')::uuid;
      exception when invalid_text_representation then
        perform public._error('DATO_INVALIDO', 'Identificador de producto inválido');
      end;
    else
      select * into v_prod from public.productos where slug = public._texto(v_linea, 'slug', 80, true);
    end if;

    if v_prod.id is null then
      perform public._error('PRODUCTO_NO_EXISTE', 'Uno de los productos ya no existe en el menú');
    end if;
    if p_solo_disponibles and (not v_prod.activo or v_prod.agotado) then
      perform public._error('PRODUCTO_NO_DISPONIBLE', format('"%s" no está disponible en este momento', v_prod.nombre));
    end if;

    if not p_solo_disponibles and not (v_linea ? 'opciones') then
      v_extra := 0; v_det := null;          -- caja sin opciones (app anterior)
    else
      select o.extra, o.detalle into v_extra, v_det from public._aplicar_opciones(v_prod, v_linea -> 'opciones') o;
    end if;

    v_clave := v_prod.id::text || '|' || coalesce(v_det, '');
    v_mapa := jsonb_set(v_mapa, array[v_clave], jsonb_build_object(
      'cantidad', coalesce((v_mapa -> v_clave ->> 'cantidad')::int, 0) + v_cant,
      'extra', v_extra, 'detalle', v_det));
    v_prod := null;
  end loop;

  for v_clave, v_linea in select * from jsonb_each(v_mapa) loop
    v_cant := (v_linea ->> 'cantidad')::int;
    if v_cant > 99 then
      perform public._error('DATO_INVALIDO', 'Máximo 99 unidades por producto');
    end if;
    select * into v_prod from public.productos where id = split_part(v_clave, '|', 1)::uuid;
    select nombre into v_cat from public.categorias where id = v_prod.categoria_id;
    insert into public.pedido_items (pedido_id, producto_id, nombre_producto, categoria_nombre, precio_unitario, cantidad, detalle)
    values (p_pedido, v_prod.id, v_prod.nombre, coalesce(v_cat, ''), v_prod.precio + (v_linea ->> 'extra')::int, v_cant, v_linea ->> 'detalle');
  end loop;
end
$$;

-- ---------- Pedido en JSON: incluye el detalle de cada línea ----------
create or replace function public._pedido_json(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id, 'numero', p.numero, 'canal', p.canal, 'estado', p.estado,
    'tipo_entrega', p.tipo_entrega, 'metodo_pago', p.metodo_pago,
    'cliente_nombre', p.cliente_nombre, 'cliente_telefono', p.cliente_telefono,
    'direccion', p.direccion, 'notas', p.notas,
    'subtotal', p.subtotal, 'costo_domicilio', p.costo_domicilio, 'descuento', p.descuento, 'total', p.total,
    'motivo_cancelacion', p.motivo_cancelacion,
    'creado_en', p.creado_en, 'entregado_en', p.entregado_en, 'cancelado_en', p.cancelado_en,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'producto_id', i.producto_id, 'nombre', i.nombre_producto, 'categoria', i.categoria_nombre,
        'precio_unitario', i.precio_unitario, 'cantidad', i.cantidad, 'subtotal', i.subtotal, 'detalle', i.detalle
      ) order by i.nombre_producto, i.detalle nulls first)
      from public.pedido_items i where i.pedido_id = p.id
    ), '[]'::jsonb)
  )
  from public.pedidos p
  where p.id = p_id
$$;

-- ---------- Menú público: opciones de cada producto y listas de bebidas ----------
create or replace function public.menu_publico()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with prods as (
    select p.*, c.slug as cat_slug, c.orden as cat_orden
    from public.productos p
    join public.categorias c on c.id = p.categoria_id
    where p.activo and c.activa
  )
  select jsonb_build_object(
    'pedidos_web_activos', a.pedidos_web_activos,
    'festividad', public._tema_efectivo(),
    'destacado', (
      select jsonb_build_object('producto', d.slug, 'titulo', a.titulo_destacado, 'foto_url', a.foto_destacado_url)
      from prods d where d.id = a.producto_destacado_id
    ),
    'bebidas', jsonb_build_object('gaseosas', to_jsonb(a.bebidas_gaseosa), 'bebidas_michelada', to_jsonb(a.bebidas_michelada)),
    'categorias', coalesce((
      select jsonb_agg(jsonb_build_object('slug', c.slug, 'nombre', c.nombre) order by c.orden, c.nombre)
      from public.categorias c
      where c.activa and exists (select 1 from prods p where p.categoria_id = c.id)
    ), '[]'::jsonb),
    'productos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', p.slug, 'categoria', p.cat_slug, 'nombre', p.nombre, 'descripcion', p.descripcion,
        'precio', p.precio, 'etiqueta', p.etiqueta, 'foto_url', p.foto_url, 'agotado', p.agotado,
        'opciones', p.opciones
      ) order by p.cat_orden, p.orden, p.nombre)
      from prods p
    ), '[]'::jsonb)
  )
  from public.ajustes a
  where a.id = 1
$$;

-- ---------- Menú para administrar: incluye las opciones ----------
create or replace function public.menu_admin()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public._requiere_staff();
  return jsonb_build_object(
    'categorias', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'slug', c.slug, 'nombre', c.nombre, 'orden', c.orden, 'activa', c.activa,
        'num_productos', (select count(*) from public.productos p where p.categoria_id = c.id)
      ) order by c.orden, c.nombre)
      from public.categorias c
    ), '[]'::jsonb),
    'productos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'slug', p.slug, 'categoria_id', p.categoria_id, 'nombre', p.nombre,
        'descripcion', p.descripcion, 'precio', p.precio, 'etiqueta', p.etiqueta, 'foto_url', p.foto_url,
        'activo', p.activo, 'agotado', p.agotado, 'orden', p.orden, 'opciones', p.opciones,
        'tiene_ventas', exists (select 1 from public.pedido_items i where i.producto_id = p.id)
      ) order by c.orden, p.orden, p.nombre)
      from public.productos p join public.categorias c on c.id = p.categoria_id
    ), '[]'::jsonb),
    'ajustes', (select to_jsonb(a) - 'id' from public.ajustes a where a.id = 1)
  );
end
$$;

-- ---------- Guardar producto: acepta opciones (si no se envían, se conservan) ----------
create or replace function public.producto_guardar(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id     uuid;
  v_cat    uuid;
  v_nombre text := public._texto(p, 'nombre', 60, true);
  v_desc   text := public._texto(p, 'descripcion', 240);
  v_precio int  := public._entero(p, 'precio', 0, 5000000);
  v_etiq   text := nullif(public._texto(p, 'etiqueta', 24), '');
  v_foto   text := nullif(public._texto(p, 'foto_url', 2000000), '');
  v_activo boolean := public._booleano(p, 'activo', true);
  v_agot   boolean := public._booleano(p, 'agotado', false);
  v_orden  int  := public._entero(p, 'orden', -1000, 100000, 0);
  v_opc    jsonb := p -> 'opciones';
  v_fila   public.productos%rowtype;
begin
  perform public._requiere_staff();
  begin
    v_cat := (p ->> 'categoria_id')::uuid;
  exception when invalid_text_representation then
    perform public._error('DATO_INVALIDO', 'Categoría inválida');
  end;
  if v_cat is null or not exists (select 1 from public.categorias where id = v_cat) then
    perform public._error('DATO_INVALIDO', 'Elige una categoría válida');
  end if;
  if v_opc is not null and not public._opciones_validas(v_opc) then
    perform public._error('DATO_INVALIDO', 'Las opciones del producto no son válidas');
  end if;

  if p ? 'id' and jsonb_typeof(p -> 'id') = 'string' then
    v_id := (p ->> 'id')::uuid;
    update public.productos
       set categoria_id = v_cat, nombre = v_nombre, descripcion = v_desc, precio = v_precio,
           etiqueta = v_etiq, foto_url = v_foto, activo = v_activo, agotado = v_agot, orden = v_orden,
           opciones = coalesce(v_opc, opciones)
     where id = v_id
    returning * into v_fila;
    if v_fila.id is null then
      perform public._error('NO_EXISTE', 'El producto no existe');
    end if;
  else
    insert into public.productos (slug, categoria_id, nombre, descripcion, precio, etiqueta, foto_url, activo, agotado, orden, opciones)
    values (public._slug_unico(v_nombre, 'productos'), v_cat, v_nombre, v_desc, v_precio, v_etiq, v_foto, v_activo, v_agot, v_orden, coalesce(v_opc, '[]'::jsonb))
    returning * into v_fila;
  end if;
  return to_jsonb(v_fila);
end
$$;

-- ---------- Listas de bebidas (las edita el dueño en Ajustes) ----------
-- p: { gaseosas?: ["Coca-Cola", ...], bebidas_michelada?: [...] }
create or replace function public.bebidas_guardar(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gas text[];
  v_mich text[];
  v_fila public.ajustes%rowtype;
begin
  perform public._requiere_staff();
  select * into v_fila from public.ajustes where id = 1;
  begin
    v_gas := case when p ? 'gaseosas' then array(select btrim(x) from jsonb_array_elements_text(p -> 'gaseosas') x) else v_fila.bebidas_gaseosa end;
    v_mich := case when p ? 'bebidas_michelada' then array(select btrim(x) from jsonb_array_elements_text(p -> 'bebidas_michelada') x) else v_fila.bebidas_michelada end;
  exception when others then
    perform public._error('DATO_INVALIDO', 'Las listas de bebidas deben ser listas de nombres');
  end;
  if not public._lista_bebidas_valida(v_gas) or not public._lista_bebidas_valida(v_mich) then
    perform public._error('DATO_INVALIDO', 'Cada lista necesita entre 1 y 30 bebidas distintas, de máximo 40 letras');
  end if;
  update public.ajustes set bebidas_gaseosa = v_gas, bebidas_michelada = v_mich where id = 1 returning * into v_fila;
  return jsonb_build_object('gaseosas', to_jsonb(v_fila.bebidas_gaseosa), 'bebidas_michelada', to_jsonb(v_fila.bebidas_michelada));
end
$$;
revoke all on function public.bebidas_guardar(jsonb) from public, anon;
grant execute on function public.bebidas_guardar(jsonb) to authenticated;

-- ---------- Pedido web: la respuesta incluye lo elegido (para el mensaje de WhatsApp) ----------
-- Crea un pedido desde la web. Devuelve número y total calculados en el servidor.
-- p_cliente: { nombre, telefono?, tipo_entrega: 'domicilio'|'recoger', direccion?, metodo_pago, notas? }
create or replace function public.crear_pedido_web(p_items jsonb, p_cliente jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_activos boolean;
  v_entrega public.tipo_entrega;
  v_pago    public.metodo_pago;
  v_dir     text;
  v_tel     text;
  v_id      uuid;
  v_ped     jsonb;
begin
  select pedidos_web_activos into v_activos from public.ajustes where id = 1;
  if not coalesce(v_activos, false) then
    perform public._error('PEDIDOS_PAUSADOS', 'En este momento no estamos recibiendo pedidos en línea');
  end if;

  -- Protección básica contra inundación de pedidos falsos
  if (select count(*) from public.pedidos where canal = 'web' and creado_en > now() - interval '10 minutes') >= 60 then
    perform public._error('DEMASIADOS_PEDIDOS', 'Estamos recibiendo muchos pedidos; intenta de nuevo en unos minutos');
  end if;

  if p_cliente is null or jsonb_typeof(p_cliente) <> 'object' then
    perform public._error('DATO_INVALIDO', 'Faltan los datos del cliente');
  end if;

  begin
    v_entrega := public._texto(p_cliente, 'tipo_entrega', 20, true)::public.tipo_entrega;
    v_pago    := public._texto(p_cliente, 'metodo_pago', 20, true)::public.metodo_pago;
  exception when invalid_text_representation then
    perform public._error('DATO_INVALIDO', 'Tipo de entrega o método de pago inválido');
  end;
  if v_entrega = 'en_local' then
    perform public._error('DATO_INVALIDO', 'Tipo de entrega inválido');
  end if;

  v_dir := public._texto(p_cliente, 'direccion', 140, v_entrega = 'domicilio');
  v_tel := public._texto(p_cliente, 'telefono', 20);
  if v_tel <> '' and v_tel !~ '^[0-9+ ()-]{7,20}$' then
    perform public._error('DATO_INVALIDO', 'Teléfono inválido');
  end if;

  insert into public.pedidos (canal, estado, tipo_entrega, metodo_pago, cliente_nombre, cliente_telefono, direccion, notas)
  values ('web', 'nuevo', v_entrega, v_pago,
          public._texto(p_cliente, 'nombre', 60, true), v_tel,
          case when v_entrega = 'domicilio' then v_dir else '' end,
          public._texto(p_cliente, 'notas', 240))
  returning id into v_id;

  perform public._insertar_items(v_id, p_items, true);

  v_ped := public._pedido_json(v_id);
  -- A la web solo se le devuelve lo necesario
  return jsonb_build_object(
    'numero', v_ped -> 'numero', 'subtotal', v_ped -> 'subtotal', 'total', v_ped -> 'total',
    'items', (select jsonb_agg(jsonb_build_object('nombre', i -> 'nombre', 'cantidad', i -> 'cantidad',
                                                  'precio_unitario', i -> 'precio_unitario', 'subtotal', i -> 'subtotal',
                                                  'detalle', i -> 'detalle'))
              from jsonb_array_elements(v_ped -> 'items') i)
  );
end
$$;
