-- =====================================================================
-- Quechimba Burger · 04 · Funciones (API de la base de datos)
-- Toda escritura pasa por aquí. Los errores llevan un código en HINT para
-- que la web y la app muestren mensajes claros.
-- =====================================================================

-- ---------- Auxiliares de validación ----------
create function public._error(p_codigo text, p_mensaje text)
returns void
language plpgsql
as $$
begin
  raise exception '%', p_mensaje using errcode = 'P0001', hint = p_codigo;
end
$$;

create function public._requiere_staff()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_staff() then
    raise exception 'No tienes permiso para esta acción' using errcode = '42501', hint = 'SIN_PERMISO';
  end if;
end
$$;

-- Lee un entero de un JSON validando tipo y rango (rechaza decimales y texto)
create function public._entero(p_json jsonb, p_campo text, p_min int, p_max int, p_defecto int default null)
returns int
language plpgsql
immutable
as $$
declare
  v jsonb := p_json -> p_campo;
  n numeric;
begin
  if v is null or jsonb_typeof(v) = 'null' then
    if p_defecto is null then
      perform public._error('DATO_INVALIDO', format('Falta el campo "%s"', p_campo));
    end if;
    return p_defecto;
  end if;
  if jsonb_typeof(v) <> 'number' then
    perform public._error('DATO_INVALIDO', format('El campo "%s" debe ser un número', p_campo));
  end if;
  n := v::text::numeric;
  if n <> trunc(n) then
    perform public._error('DATO_INVALIDO', format('El campo "%s" debe ser un número entero', p_campo));
  end if;
  if n < p_min or n > p_max then
    perform public._error('DATO_INVALIDO', format('El campo "%s" debe estar entre %s y %s', p_campo, p_min, p_max));
  end if;
  return n::int;
end
$$;

-- Lee un texto de un JSON, recortado, validando longitud
create function public._texto(p_json jsonb, p_campo text, p_max int, p_requerido boolean default false)
returns text
language plpgsql
immutable
as $$
declare
  v jsonb := p_json -> p_campo;
  t text;
begin
  if v is null or jsonb_typeof(v) = 'null' then
    t := '';
  elsif jsonb_typeof(v) <> 'string' then
    perform public._error('DATO_INVALIDO', format('El campo "%s" debe ser texto', p_campo));
  else
    t := btrim(v #>> '{}');
  end if;
  if p_requerido and t = '' then
    perform public._error('DATO_INVALIDO', format('El campo "%s" es obligatorio', p_campo));
  end if;
  if char_length(t) > p_max then
    perform public._error('DATO_INVALIDO', format('El campo "%s" admite máximo %s caracteres', p_campo, p_max));
  end if;
  return t;
end
$$;

create function public._booleano(p_json jsonb, p_campo text, p_defecto boolean)
returns boolean
language plpgsql
immutable
as $$
declare
  v jsonb := p_json -> p_campo;
begin
  if v is null or jsonb_typeof(v) = 'null' then
    return p_defecto;
  end if;
  if jsonb_typeof(v) <> 'boolean' then
    perform public._error('DATO_INVALIDO', format('El campo "%s" debe ser verdadero o falso', p_campo));
  end if;
  return v::text::boolean;
end
$$;

-- "Hamburguesa Costeña" → "hamburguesa-costena"
create function public._slug(p_texto text)
returns text
language sql
immutable
as $$
  select coalesce(nullif(
    btrim(regexp_replace(translate(lower(p_texto), 'áàäâéèëêíìïîóòöôúùüûñç', 'aaaaeeeeiiiioooouuuunc'), '[^a-z0-9]+', '-', 'g'), '-'),
  ''), 'item')
$$;

create function public._slug_unico(p_texto text, p_tabla text)
returns text
language plpgsql
as $$
declare
  v_base text := left(public._slug(p_texto), 50);
  v_slug text := v_base;
  v_n    int  := 1;
  v_existe boolean;
begin
  loop
    execute format('select exists (select 1 from public.%I where slug = $1)', p_tabla) into v_existe using v_slug;
    exit when not v_existe;
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;
  return v_slug;
end
$$;

-- ---------- Representación JSON de un pedido ----------
create function public._pedido_json(p_id uuid)
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
        'precio_unitario', i.precio_unitario, 'cantidad', i.cantidad, 'subtotal', i.subtotal
      ) order by i.nombre_producto)
      from public.pedido_items i where i.pedido_id = p.id
    ), '[]'::jsonb)
  )
  from public.pedidos p
  where p.id = p_id
$$;

-- ---------- Inserta los ítems de un pedido con precios del servidor ----------
-- p_lineas: [{ "slug": "...", "cantidad": 2 }] o [{ "producto_id": "uuid", "cantidad": 2 }]
-- Las cantidades repetidas del mismo producto se suman. Los precios SIEMPRE
-- salen de la tabla productos: el cliente nunca envía precios.
create function public._insertar_items(p_pedido uuid, p_lineas jsonb, p_solo_disponibles boolean)
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
  v_mapa  jsonb := '{}'::jsonb;   -- producto_id → cantidad acumulada
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

    v_clave := v_prod.id::text;
    v_mapa := jsonb_set(v_mapa, array[v_clave], to_jsonb(coalesce((v_mapa ->> v_clave)::int, 0) + v_cant));
    v_prod := null;
  end loop;

  for v_clave, v_linea in select * from jsonb_each(v_mapa) loop
    v_cant := (v_linea #>> '{}')::int;
    if v_cant > 99 then
      perform public._error('DATO_INVALIDO', 'Máximo 99 unidades por producto');
    end if;
    select * into v_prod from public.productos where id = v_clave::uuid;
    select nombre into v_cat from public.categorias where id = v_prod.categoria_id;
    insert into public.pedido_items (pedido_id, producto_id, nombre_producto, categoria_nombre, precio_unitario, cantidad)
    values (p_pedido, v_prod.id, v_prod.nombre, coalesce(v_cat, ''), v_prod.precio, v_cant);
  end loop;
end
$$;

-- =====================================================================
-- PÚBLICAS (web, rol anon)
-- =====================================================================

-- Menú visible en la web
create function public.menu_publico()
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
    'destacado', (
      select jsonb_build_object('producto', d.slug, 'titulo', a.titulo_destacado, 'foto_url', a.foto_destacado_url)
      from prods d where d.id = a.producto_destacado_id
    ),
    'categorias', coalesce((
      select jsonb_agg(jsonb_build_object('slug', c.slug, 'nombre', c.nombre) order by c.orden, c.nombre)
      from public.categorias c
      where c.activa and exists (select 1 from prods p where p.categoria_id = c.id)
    ), '[]'::jsonb),
    'productos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', p.slug, 'categoria', p.cat_slug, 'nombre', p.nombre, 'descripcion', p.descripcion,
        'precio', p.precio, 'etiqueta', p.etiqueta, 'foto_url', p.foto_url, 'agotado', p.agotado
      ) order by p.cat_orden, p.orden, p.nombre)
      from prods p
    ), '[]'::jsonb)
  )
  from public.ajustes a
  where a.id = 1
$$;

-- Crea un pedido desde la web. Devuelve número y total calculados en el servidor.
-- p_cliente: { nombre, telefono?, tipo_entrega: 'domicilio'|'recoger', direccion?, metodo_pago, notas? }
create function public.crear_pedido_web(p_items jsonb, p_cliente jsonb)
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
                                                  'precio_unitario', i -> 'precio_unitario', 'subtotal', i -> 'subtotal'))
              from jsonb_array_elements(v_ped -> 'items') i)
  );
end
$$;

-- Información mínima para la app de escritorio antes de iniciar sesión
create function public.app_info()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('version_minima_escritorio', version_minima_escritorio) from public.ajustes where id = 1
$$;

-- =====================================================================
-- PERSONAL (rol authenticated + tabla staff)
-- =====================================================================

create function public.perfil_actual()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select jsonb_build_object('es_staff', true, 'nombre', s.nombre, 'rol', s.rol) from public.staff s where s.user_id = auth.uid()),
    jsonb_build_object('es_staff', false)
  )
$$;

-- Menú completo para administrar (incluye ocultos, agotados y si tienen ventas)
create function public.menu_admin()
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
        'activo', p.activo, 'agotado', p.agotado, 'orden', p.orden,
        'tiene_ventas', exists (select 1 from public.pedido_items i where i.producto_id = p.id)
      ) order by c.orden, p.orden, p.nombre)
      from public.productos p join public.categorias c on c.id = p.categoria_id
    ), '[]'::jsonb),
    'ajustes', (select to_jsonb(a) - 'id' from public.ajustes a where a.id = 1)
  );
end
$$;

create function public.categoria_guardar(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id     uuid;
  v_nombre text := public._texto(p, 'nombre', 40, true);
  v_orden  int  := public._entero(p, 'orden', -1000, 100000, 0);
  v_activa boolean := public._booleano(p, 'activa', true);
  v_fila   public.categorias%rowtype;
begin
  perform public._requiere_staff();
  if p ? 'id' and jsonb_typeof(p -> 'id') = 'string' then
    v_id := (p ->> 'id')::uuid;
    update public.categorias set nombre = v_nombre, orden = v_orden, activa = v_activa
     where id = v_id returning * into v_fila;
    if v_fila.id is null then
      perform public._error('NO_EXISTE', 'La categoría no existe');
    end if;
  else
    insert into public.categorias (slug, nombre, orden, activa)
    values (public._slug_unico(v_nombre, 'categorias'), v_nombre, v_orden, v_activa)
    returning * into v_fila;
  end if;
  return to_jsonb(v_fila);
end
$$;

create function public.categoria_eliminar(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._requiere_staff();
  if exists (select 1 from public.productos where categoria_id = p_id) then
    perform public._error('CATEGORIA_CON_PRODUCTOS', 'La categoría tiene productos; muévelos o elimínalos primero');
  end if;
  delete from public.categorias where id = p_id;
end
$$;

create function public.producto_guardar(p jsonb)
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

  if p ? 'id' and jsonb_typeof(p -> 'id') = 'string' then
    v_id := (p ->> 'id')::uuid;
    update public.productos
       set categoria_id = v_cat, nombre = v_nombre, descripcion = v_desc, precio = v_precio,
           etiqueta = v_etiq, foto_url = v_foto, activo = v_activo, agotado = v_agot, orden = v_orden
     where id = v_id
    returning * into v_fila;
    if v_fila.id is null then
      perform public._error('NO_EXISTE', 'El producto no existe');
    end if;
  else
    insert into public.productos (slug, categoria_id, nombre, descripcion, precio, etiqueta, foto_url, activo, agotado, orden)
    values (public._slug_unico(v_nombre, 'productos'), v_cat, v_nombre, v_desc, v_precio, v_etiq, v_foto, v_activo, v_agot, v_orden)
    returning * into v_fila;
  end if;
  return to_jsonb(v_fila);
end
$$;

create function public.producto_eliminar(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._requiere_staff();
  if exists (select 1 from public.pedido_items where producto_id = p_id) then
    perform public._error('PRODUCTO_CON_VENTAS', 'Este producto tiene ventas registradas; ocúltalo en lugar de eliminarlo');
  end if;
  delete from public.productos where id = p_id;
end
$$;

create function public.ajustes_guardar(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fila public.ajustes%rowtype;
  v_dest uuid;
  v_ver  text;
begin
  perform public._requiere_staff();
  select * into v_fila from public.ajustes where id = 1;

  if p ? 'producto_destacado_id' then
    if jsonb_typeof(p -> 'producto_destacado_id') = 'null' then
      v_dest := null;
    else
      begin
        v_dest := (p ->> 'producto_destacado_id')::uuid;
      exception when invalid_text_representation then
        perform public._error('DATO_INVALIDO', 'Producto destacado inválido');
      end;
      if not exists (select 1 from public.productos where id = v_dest) then
        perform public._error('DATO_INVALIDO', 'El producto destacado no existe');
      end if;
    end if;
  else
    v_dest := v_fila.producto_destacado_id;
  end if;

  v_ver := case when p ? 'version_minima_escritorio' then public._texto(p, 'version_minima_escritorio', 20, true)
                else v_fila.version_minima_escritorio end;
  if v_ver !~ '^\d+\.\d+\.\d+$' then
    perform public._error('DATO_INVALIDO', 'La versión debe tener el formato 1.2.3');
  end if;

  update public.ajustes set
    pedidos_web_activos       = public._booleano(p, 'pedidos_web_activos', v_fila.pedidos_web_activos),
    producto_destacado_id     = v_dest,
    titulo_destacado          = case when p ? 'titulo_destacado' then public._texto(p, 'titulo_destacado', 40) else v_fila.titulo_destacado end,
    foto_destacado_url        = case when p ? 'foto_destacado_url' then nullif(public._texto(p, 'foto_destacado_url', 2000000), '') else v_fila.foto_destacado_url end,
    url_sitio                 = case when p ? 'url_sitio' then public._texto(p, 'url_sitio', 300) else v_fila.url_sitio end,
    version_minima_escritorio = v_ver
  where id = 1
  returning * into v_fila;
  return to_jsonb(v_fila) - 'id';
end
$$;

-- Lista pedidos de un rango de fechas (en hora de Colombia)
create function public.pedidos_listar(p_desde date, p_hasta date, p_estados public.estado_pedido[] default null, p_tz text default 'America/Bogota')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public._requiere_staff();
  if p_desde is null or p_hasta is null or p_hasta < p_desde then
    perform public._error('RANGO_INVALIDO', 'Rango de fechas inválido');
  end if;
  return coalesce((
    select jsonb_agg(public._pedido_json(x.id) order by x.creado_en desc)
    from (
      select id, creado_en from public.pedidos
      where creado_en >= (p_desde::timestamp at time zone p_tz)
        and creado_en <  ((p_hasta + 1)::timestamp at time zone p_tz)
        and (p_estados is null or estado = any (p_estados))
      order by creado_en desc
      limit 1000
    ) x
  ), '[]'::jsonb);
end
$$;

create function public.pedido_cambiar_estado(p_id uuid, p_estado public.estado_pedido, p_motivo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actual public.estado_pedido;
begin
  perform public._requiere_staff();
  select estado into v_actual from public.pedidos where id = p_id for update;
  if v_actual is null then
    perform public._error('NO_EXISTE', 'El pedido no existe');
  end if;
  if not public.transicion_valida(v_actual, p_estado) then
    perform public._error('TRANSICION_INVALIDA', format('No se puede pasar de "%s" a "%s"', v_actual, p_estado));
  end if;
  if p_motivo is not null and char_length(p_motivo) > 200 then
    perform public._error('DATO_INVALIDO', 'El motivo admite máximo 200 caracteres');
  end if;
  update public.pedidos
     set estado = p_estado,
         motivo_cancelacion = case when p_estado = 'cancelado' then nullif(btrim(coalesce(p_motivo, '')), '') else motivo_cancelacion end
   where id = p_id;
  return public._pedido_json(p_id);
end
$$;

-- Ajusta el cobro (domicilio, descuento, método de pago) antes de entregar
create function public.pedido_actualizar_cobro(p_id uuid, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ped public.pedidos%rowtype;
  v_pago public.metodo_pago;
begin
  perform public._requiere_staff();
  select * into v_ped from public.pedidos where id = p_id for update;
  if v_ped.id is null then
    perform public._error('NO_EXISTE', 'El pedido no existe');
  end if;
  if v_ped.estado in ('entregado', 'cancelado') then
    perform public._error('PEDIDO_CERRADO', 'El pedido ya está cerrado');
  end if;
  begin
    v_pago := coalesce(nullif(public._texto(p, 'metodo_pago', 20), ''), v_ped.metodo_pago::text)::public.metodo_pago;
  exception when invalid_text_representation then
    perform public._error('DATO_INVALIDO', 'Método de pago inválido');
  end;
  update public.pedidos set
    costo_domicilio = public._entero(p, 'costo_domicilio', 0, 1000000, v_ped.costo_domicilio),
    descuento       = public._entero(p, 'descuento', 0, 5000000, v_ped.descuento),
    metodo_pago     = v_pago
  where id = p_id;
  return public._pedido_json(p_id);
exception when check_violation then
  perform public._error('DATO_INVALIDO', 'El descuento no puede ser mayor que el total');
  return null;
end
$$;

-- Registra una venta hecha en el local o por WhatsApp
-- p_datos: { canal: 'local'|'whatsapp', tipo_entrega, metodo_pago, cliente_nombre?, cliente_telefono?,
--            direccion?, notas?, costo_domicilio?, descuento?, entregado?: true }
create function public.venta_registrar(p_items jsonb, p_datos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_canal   public.canal_pedido;
  v_entrega public.tipo_entrega;
  v_pago    public.metodo_pago;
  v_id      uuid;
begin
  perform public._requiere_staff();
  if p_datos is null or jsonb_typeof(p_datos) <> 'object' then
    perform public._error('DATO_INVALIDO', 'Faltan los datos de la venta');
  end if;
  begin
    v_canal   := public._texto(p_datos, 'canal', 20, true)::public.canal_pedido;
    v_entrega := public._texto(p_datos, 'tipo_entrega', 20, true)::public.tipo_entrega;
    v_pago    := public._texto(p_datos, 'metodo_pago', 20, true)::public.metodo_pago;
  exception when invalid_text_representation then
    perform public._error('DATO_INVALIDO', 'Canal, entrega o método de pago inválido');
  end;
  if v_canal = 'web' then
    perform public._error('DATO_INVALIDO', 'Las ventas web se registran solas desde la página');
  end if;

  insert into public.pedidos (canal, estado, tipo_entrega, metodo_pago, cliente_nombre, cliente_telefono,
                              direccion, notas, costo_domicilio, creado_por)
  values (v_canal, 'nuevo', v_entrega, v_pago,
          public._texto(p_datos, 'cliente_nombre', 60), public._texto(p_datos, 'cliente_telefono', 20),
          public._texto(p_datos, 'direccion', 140), public._texto(p_datos, 'notas', 240),
          public._entero(p_datos, 'costo_domicilio', 0, 1000000, 0), auth.uid())
  returning id into v_id;

  perform public._insertar_items(v_id, p_items, false);

  begin
    update public.pedidos set descuento = public._entero(p_datos, 'descuento', 0, 5000000, 0) where id = v_id;
  exception when check_violation then
    perform public._error('DATO_INVALIDO', 'El descuento no puede ser mayor que el total');
  end;

  if public._booleano(p_datos, 'entregado', true) then
    update public.pedidos set estado = 'entregado' where id = v_id;
  end if;
  return public._pedido_json(v_id);
end
$$;
