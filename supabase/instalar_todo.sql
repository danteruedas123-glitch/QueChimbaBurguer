-- =====================================================================
-- Quechimba Burger · INSTALACIÓN COMPLETA (generado automáticamente)
-- Pegar TODO en Supabase → SQL Editor → Run. Ejecutar UNA sola vez en un
-- proyecto nuevo. Incluye: 9 migraciones + menú inicial.
-- No editar aquí: editar supabase/migrations y correr "npm run sql:unificar".
-- =====================================================================

-- >>>>>>>>>> 20261106000001_esquema.sql
-- =====================================================================
-- Quechimba Burger · 01 · Esquema
-- Tablas, tipos y restricciones de integridad.
-- Reglas de dinero: TODO se guarda en pesos colombianos ENTEROS (sin
-- decimales ni flotantes) para que las sumas de la contabilidad sean exactas.
-- =====================================================================

-- ---------- Tipos ----------
create type public.estado_pedido as enum ('nuevo', 'preparando', 'listo', 'entregado', 'cancelado');
create type public.canal_pedido  as enum ('web', 'whatsapp', 'local');
create type public.tipo_entrega  as enum ('domicilio', 'recoger', 'en_local');
create type public.metodo_pago   as enum ('efectivo', 'nequi', 'daviplata', 'transferencia', 'tarjeta', 'otro');

-- ---------- Personal autorizado (encargados) ----------
-- Solo los usuarios de esta tabla pueden usar la app de escritorio.
create table public.staff (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  nombre     text not null check (char_length(nombre) between 1 and 80),
  rol        text not null default 'encargado' check (rol in ('admin', 'encargado')),
  creado_en  timestamptz not null default now()
);

-- ---------- Menú ----------
create table public.categorias (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nombre     text not null check (char_length(btrim(nombre)) between 1 and 40),
  orden      int  not null default 0,
  activa     boolean not null default true,
  creado_en  timestamptz not null default now()
);

create table public.productos (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  categoria_id   uuid not null references public.categorias (id) on delete restrict,
  nombre         text not null check (char_length(btrim(nombre)) between 1 and 60),
  descripcion    text not null default '' check (char_length(descripcion) <= 240),
  precio         int  not null check (precio between 0 and 5000000),
  etiqueta       text check (etiqueta is null or char_length(etiqueta) between 1 and 24),
  foto_url       text check (foto_url is null or char_length(foto_url) <= 2000000),
  activo         boolean not null default true,   -- visible en la web
  agotado        boolean not null default false,  -- visible, pero no se puede pedir
  orden          int  not null default 0,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index productos_categoria_idx on public.productos (categoria_id, orden);

-- ---------- Ajustes generales (una sola fila) ----------
create table public.ajustes (
  id                        int primary key default 1 check (id = 1),
  pedidos_web_activos       boolean not null default true,
  producto_destacado_id     uuid references public.productos (id) on delete set null,
  titulo_destacado          text not null default 'La estrella de la casa' check (char_length(titulo_destacado) <= 40),
  foto_destacado_url        text check (foto_destacado_url is null or char_length(foto_destacado_url) <= 2000000),
  url_sitio                 text not null default '' check (char_length(url_sitio) <= 300),
  version_minima_escritorio text not null default '1.0.0' check (version_minima_escritorio ~ '^\d+\.\d+\.\d+$'),
  actualizado_en            timestamptz not null default now()
);
insert into public.ajustes (id) values (1);

-- ---------- Pedidos ----------
create table public.pedidos (
  id                 uuid primary key default gen_random_uuid(),
  numero             bigint generated always as identity unique,
  canal              public.canal_pedido  not null,
  estado             public.estado_pedido not null default 'nuevo',
  tipo_entrega       public.tipo_entrega  not null,
  metodo_pago        public.metodo_pago   not null,
  cliente_nombre     text not null default '' check (char_length(cliente_nombre) <= 60),
  cliente_telefono   text not null default '' check (char_length(cliente_telefono) <= 20),
  direccion          text not null default '' check (char_length(direccion) <= 140),
  notas              text not null default '' check (char_length(notas) <= 240),
  -- Dinero (pesos enteros). subtotal lo mantiene un trigger a partir de los ítems.
  subtotal           int not null default 0 check (subtotal >= 0),
  costo_domicilio    int not null default 0 check (costo_domicilio between 0 and 1000000),
  descuento          int not null default 0 check (descuento >= 0),
  total              int generated always as (subtotal + costo_domicilio - descuento) stored,
  motivo_cancelacion text check (motivo_cancelacion is null or char_length(motivo_cancelacion) <= 200),
  creado_por         uuid references auth.users (id) on delete set null,
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now(),
  entregado_en       timestamptz,
  cancelado_en       timestamptz,
  constraint pedidos_total_no_negativo check (subtotal + costo_domicilio - descuento >= 0),
  constraint pedidos_domicilio_con_direccion check (tipo_entrega <> 'domicilio' or canal <> 'web' or char_length(btrim(direccion)) > 0),
  -- Las fechas deben ser coherentes con el estado. Un pedido entregado que
  -- luego se anula conserva su entregado_en (historial) y gana cancelado_en.
  constraint pedidos_fechas_estado check (
       (estado in ('nuevo', 'preparando', 'listo') and entregado_en is null and cancelado_en is null)
    or (estado = 'entregado' and entregado_en is not null and cancelado_en is null)
    or (estado = 'cancelado' and cancelado_en is not null)
  )
);
create index pedidos_creado_idx on public.pedidos (creado_en);
create index pedidos_estado_idx on public.pedidos (estado, creado_en);

create table public.pedido_items (
  id               uuid primary key default gen_random_uuid(),
  pedido_id        uuid not null references public.pedidos (id) on delete cascade,
  producto_id      uuid references public.productos (id) on delete restrict,
  -- Copia del nombre y precio AL MOMENTO de la venta: si luego cambia el
  -- precio del menú, la contabilidad histórica no se altera.
  nombre_producto  text not null check (char_length(nombre_producto) between 1 and 60),
  categoria_nombre text not null default '' check (char_length(categoria_nombre) <= 40),
  precio_unitario  int  not null check (precio_unitario between 0 and 5000000),
  cantidad         int  not null check (cantidad between 1 and 99),
  subtotal         int  generated always as (precio_unitario * cantidad) stored
);
create index pedido_items_pedido_idx on public.pedido_items (pedido_id);
create index pedido_items_producto_idx on public.pedido_items (producto_id);

-- ---------- Bitácora de cambios de estado (auditoría) ----------
create table public.pedido_eventos (
  id               bigint generated always as identity primary key,
  pedido_id        uuid not null references public.pedidos (id) on delete cascade,
  estado_anterior  public.estado_pedido,
  estado_nuevo     public.estado_pedido not null,
  motivo           text,
  usuario_id       uuid,
  creado_en        timestamptz not null default now()
);
create index pedido_eventos_pedido_idx on public.pedido_eventos (pedido_id, creado_en);


-- >>>>>>>>>> 20261106000002_integridad.sql
-- =====================================================================
-- Quechimba Burger · 02 · Integridad de datos
-- Triggers que garantizan que la contabilidad nunca quede inconsistente,
-- sin importar desde dónde se modifiquen los datos.
-- =====================================================================

-- ---------- Máquina de estados de un pedido ----------
--   nuevo ──► preparando ──► listo ──► entregado
--     │           │            │           │
--     └───────────┴────────────┴──► cancelado ◄── (anulación, con motivo)
-- Saltos hacia adelante permitidos (ej. nuevo → entregado para ventas
-- de mostrador). Nunca se vuelve atrás ni se "revive" un cancelado.
create function public.transicion_valida(p_desde public.estado_pedido, p_hacia public.estado_pedido)
returns boolean
language sql immutable
as $$
  select case
    when p_desde = p_hacia then false
    when p_desde = 'cancelado' then false
    when p_desde = 'entregado' then p_hacia = 'cancelado'
    when p_hacia = 'cancelado' then true
    else array_position(array['nuevo','preparando','listo','entregado']::public.estado_pedido[], p_hacia)
       > array_position(array['nuevo','preparando','listo','entregado']::public.estado_pedido[], p_desde)
  end
$$;

-- ---------- Recalcular el subtotal del pedido desde sus ítems ----------
create function public.tg_items_recalcular()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido uuid := coalesce(new.pedido_id, old.pedido_id);
  v_estado public.estado_pedido;
begin
  select estado into v_estado from public.pedidos where id = v_pedido for update;
  if v_estado in ('entregado', 'cancelado') then
    raise exception 'El pedido ya está cerrado (%); sus productos no se pueden modificar', v_estado
      using errcode = 'P0001';
  end if;
  -- Bandera de transacción: autoriza al trigger de pedidos a aceptar el nuevo subtotal.
  perform set_config('qb.recalculo', 'on', true);
  update public.pedidos
     set subtotal = (select coalesce(sum(subtotal), 0) from public.pedido_items where pedido_id = v_pedido)
   where id = v_pedido;
  perform set_config('qb.recalculo', 'off', true);
  return null;
end
$$;

create trigger pedido_items_recalcular
after insert or update or delete on public.pedido_items
for each row execute function public.tg_items_recalcular();

-- ---------- Reglas al insertar un pedido ----------
create function public.tg_pedidos_insert()
returns trigger
language plpgsql
as $$
begin
  if new.subtotal <> 0 then
    raise exception 'El subtotal se calcula a partir de los productos; no se puede fijar a mano'
      using errcode = 'P0001';
  end if;
  new.creado_en := coalesce(new.creado_en, now());
  new.actualizado_en := now();
  if new.estado = 'entregado' then
    new.entregado_en := coalesce(new.entregado_en, new.creado_en);
  elsif new.estado = 'cancelado' then
    raise exception 'Un pedido no se puede crear cancelado' using errcode = 'P0001';
  end if;
  return new;
end
$$;

create trigger pedidos_insert
before insert on public.pedidos
for each row execute function public.tg_pedidos_insert();

-- ---------- Reglas al actualizar un pedido ----------
create function public.tg_pedidos_update()
returns trigger
language plpgsql
as $$
begin
  -- Campos que nunca cambian
  if new.id <> old.id or new.numero <> old.numero or new.canal <> old.canal
     or new.creado_en <> old.creado_en or new.creado_por is distinct from old.creado_por then
    raise exception 'Campos de origen del pedido no modificables' using errcode = 'P0001';
  end if;

  -- El subtotal solo lo cambia el recálculo automático
  if new.subtotal <> old.subtotal and coalesce(current_setting('qb.recalculo', true), 'off') <> 'on' then
    raise exception 'El subtotal se calcula a partir de los productos; no se puede fijar a mano'
      using errcode = 'P0001';
  end if;

  -- Pedido cerrado: solo se permite anular un entregado (con motivo)
  if old.estado = 'cancelado' then
    raise exception 'El pedido #% está cancelado y no se puede modificar', old.numero using errcode = 'P0001';
  end if;
  if old.estado = 'entregado' then
    if new.estado <> 'cancelado' then
      raise exception 'El pedido #% ya fue entregado; solo se puede anular', old.numero using errcode = 'P0001';
    end if;
    if new.subtotal <> old.subtotal or new.costo_domicilio <> old.costo_domicilio or new.descuento <> old.descuento
       or new.metodo_pago <> old.metodo_pago then
      raise exception 'Los valores de un pedido entregado no se pueden modificar' using errcode = 'P0001';
    end if;
  end if;

  -- Transición de estado
  if new.estado <> old.estado then
    if not public.transicion_valida(old.estado, new.estado) then
      raise exception 'Cambio de estado no permitido: % → %', old.estado, new.estado using errcode = 'P0001';
    end if;
    if new.estado = 'entregado' then
      new.entregado_en := now();
    elsif new.estado = 'cancelado' then
      new.cancelado_en := now();
      if old.estado = 'entregado' and char_length(btrim(coalesce(new.motivo_cancelacion, ''))) < 3 then
        raise exception 'Para anular un pedido entregado escribe el motivo' using errcode = 'P0001';
      end if;
    end if;
  else
    new.entregado_en := old.entregado_en;
    new.cancelado_en := old.cancelado_en;
  end if;

  new.actualizado_en := now();
  return new;
end
$$;

create trigger pedidos_update
before update on public.pedidos
for each row execute function public.tg_pedidos_update();

-- ---------- Bitácora automática de estados ----------
create function public.tg_pedidos_evento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.pedido_eventos (pedido_id, estado_anterior, estado_nuevo, usuario_id)
    values (new.id, null, new.estado, auth.uid());
  elsif new.estado <> old.estado then
    insert into public.pedido_eventos (pedido_id, estado_anterior, estado_nuevo, motivo, usuario_id)
    values (new.id, old.estado, new.estado, new.motivo_cancelacion, auth.uid());
  end if;
  return null;
end
$$;

create trigger pedidos_evento
after insert or update on public.pedidos
for each row execute function public.tg_pedidos_evento();

-- ---------- Los pedidos jamás se borran (se cancelan) ----------
create function public.tg_prohibir_borrado()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Los registros contables no se borran; cancela el pedido en su lugar' using errcode = 'P0001';
end
$$;

create trigger pedidos_sin_borrado
before delete on public.pedidos
for each row execute function public.tg_prohibir_borrado();

create trigger eventos_sin_cambios
before update or delete on public.pedido_eventos
for each row execute function public.tg_prohibir_borrado();

-- ---------- Marca de actualización en productos ----------
create function public.tg_tocar_actualizado()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();
  return new;
end
$$;

create trigger productos_actualizado
before update on public.productos
for each row execute function public.tg_tocar_actualizado();

create trigger ajustes_actualizado
before update on public.ajustes
for each row execute function public.tg_tocar_actualizado();


-- >>>>>>>>>> 20261106000003_seguridad.sql
-- =====================================================================
-- Quechimba Burger · 03 · Seguridad (RLS y permisos)
-- Principio: nadie escribe directo en las tablas. Toda escritura pasa por
-- funciones (04_funciones.sql) que validan los datos. Las tablas solo se
-- leen según el rol:
--   anon (la web)        → nada directo; usa menu_publico() y crear_pedido_web()
--   authenticated staff  → lectura del menú, pedidos y ajustes (y Realtime)
--   authenticated NO staff → nada
-- =====================================================================

create function public.es_staff()
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.staff where user_id = auth.uid())
$$;

-- Quitar cualquier permiso por defecto y dar solo lo necesario
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated, public;
revoke all on all sequences in schema public from anon, authenticated;

alter table public.staff          enable row level security;
alter table public.categorias     enable row level security;
alter table public.productos      enable row level security;
alter table public.ajustes        enable row level security;
alter table public.pedidos        enable row level security;
alter table public.pedido_items   enable row level security;
alter table public.pedido_eventos enable row level security;

-- Lectura para el personal (la app de escritorio y Realtime necesitan SELECT)
grant select on public.staff, public.categorias, public.productos, public.ajustes,
                public.pedidos, public.pedido_items, public.pedido_eventos to authenticated;

create policy staff_lee_staff      on public.staff          for select to authenticated using (public.es_staff());
create policy staff_lee_categorias on public.categorias     for select to authenticated using (public.es_staff());
create policy staff_lee_productos  on public.productos      for select to authenticated using (public.es_staff());
create policy staff_lee_ajustes    on public.ajustes        for select to authenticated using (public.es_staff());
create policy staff_lee_pedidos    on public.pedidos        for select to authenticated using (public.es_staff());
create policy staff_lee_items      on public.pedido_items   for select to authenticated using (public.es_staff());
create policy staff_lee_eventos    on public.pedido_eventos for select to authenticated using (public.es_staff());

-- Funciones auxiliares internas: solo el dueño las ejecuta
grant execute on function public.es_staff() to authenticated;
grant execute on function public.transicion_valida(public.estado_pedido, public.estado_pedido) to anon, authenticated;


-- >>>>>>>>>> 20261106000004_funciones.sql
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


-- >>>>>>>>>> 20261106000005_reportes.sql
-- =====================================================================
-- Quechimba Burger · 05 · Reportes de contabilidad
-- Reglas contables (documentadas y probadas):
--   • Una VENTA es un pedido en estado "entregado".
--   • La fecha de la venta es la fecha en que se CREÓ el pedido, en hora
--     de Colombia (America/Bogota). Un pedido de las 11:50 p. m. cuenta para
--     ese día aunque se entregue después de medianoche.
--   • Total de la venta = subtotal de productos + domicilio − descuento.
--   • Los cancelados y los pendientes se informan aparte; no suman ventas.
--   • Invariantes: Σ por método de pago = Σ por canal = Σ por día = total;
--     Σ por producto = Σ por categoría = subtotal de productos.
-- =====================================================================

create function public.reporte_ventas(p_desde date, p_hasta date, p_tz text default 'America/Bogota')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ini timestamptz;
  v_fin timestamptz;
  v_res jsonb;
begin
  perform public._requiere_staff();
  if p_desde is null or p_hasta is null or p_hasta < p_desde then
    perform public._error('RANGO_INVALIDO', 'Rango de fechas inválido');
  end if;
  if p_hasta - p_desde > 366 then
    perform public._error('RANGO_INVALIDO', 'El rango máximo es de un año');
  end if;
  v_ini := p_desde::timestamp at time zone p_tz;
  v_fin := (p_hasta + 1)::timestamp at time zone p_tz;

  with base as (
    select * from public.pedidos where creado_en >= v_ini and creado_en < v_fin
  ),
  ventas as (
    select * from base where estado = 'entregado'
  ),
  items as (
    select i.*, coalesce(p.nombre, i.nombre_producto) as nombre_actual
    from public.pedido_items i
    join ventas v on v.id = i.pedido_id
    left join public.productos p on p.id = i.producto_id
  )
  select jsonb_build_object(
    'desde', p_desde,
    'hasta', p_hasta,
    'zona_horaria', p_tz,
    'generado_en', now(),
    'resumen', (
      select jsonb_build_object(
        'total',           coalesce(sum(total), 0),
        'subtotal',        coalesce(sum(subtotal), 0),
        'domicilios',      coalesce(sum(costo_domicilio), 0),
        'descuentos',      coalesce(sum(descuento), 0),
        'pedidos',         count(*),
        'ticket_promedio', case when count(*) = 0 then 0 else round(sum(total)::numeric / count(*))::bigint end,
        'unidades',        (select coalesce(sum(cantidad), 0) from items)
      ) from ventas
    ),
    'cancelados', (
      select jsonb_build_object('pedidos', count(*), 'total', coalesce(sum(total), 0))
      from base where estado = 'cancelado'
    ),
    'pendientes', (
      select jsonb_build_object('pedidos', count(*), 'total', coalesce(sum(total), 0))
      from base where estado in ('nuevo', 'preparando', 'listo')
    ),
    'por_metodo_pago', coalesce((
      select jsonb_agg(x order by x.total desc, x.metodo)
      from (select metodo_pago as metodo, count(*) as pedidos, sum(total) as total from ventas group by metodo_pago) x
    ), '[]'::jsonb),
    'por_canal', coalesce((
      select jsonb_agg(x order by x.total desc, x.canal)
      from (select canal, count(*) as pedidos, sum(total) as total from ventas group by canal) x
    ), '[]'::jsonb),
    'por_entrega', coalesce((
      select jsonb_agg(x order by x.total desc, x.tipo)
      from (select tipo_entrega as tipo, count(*) as pedidos, sum(total) as total from ventas group by tipo_entrega) x
    ), '[]'::jsonb),
    'por_dia', (
      select jsonb_agg(jsonb_build_object('fecha', d.fecha, 'pedidos', coalesce(v.pedidos, 0), 'total', coalesce(v.total, 0)) order by d.fecha)
      from (select generate_series(p_desde, p_hasta, interval '1 day')::date as fecha) d
      left join (
        select (creado_en at time zone p_tz)::date as fecha, count(*) as pedidos, sum(total) as total
        from ventas group by 1
      ) v on v.fecha = d.fecha
    ),
    'por_hora', (
      select jsonb_agg(jsonb_build_object('hora', h.hora, 'pedidos', coalesce(v.pedidos, 0), 'total', coalesce(v.total, 0)) order by h.hora)
      from (select generate_series(0, 23) as hora) h
      left join (
        select extract(hour from creado_en at time zone p_tz)::int as hora, count(*) as pedidos, sum(total) as total
        from ventas group by 1
      ) v on v.hora = h.hora
    ),
    'por_producto', coalesce((
      select jsonb_agg(x order by x.total desc, x.nombre)
      from (
        select max(nombre_actual) as nombre, max(categoria_nombre) as categoria,
               sum(cantidad) as unidades, sum(subtotal) as total
        from items
        group by coalesce(producto_id::text, nombre_producto)
      ) x
    ), '[]'::jsonb),
    'por_categoria', coalesce((
      select jsonb_agg(x order by x.total desc, x.categoria)
      from (select categoria_nombre as categoria, sum(cantidad) as unidades, sum(subtotal) as total from items group by categoria_nombre) x
    ), '[]'::jsonb)
  ) into v_res;

  return v_res;
end
$$;

-- =====================================================================
-- Permisos de ejecución (al final, para cubrir todas las funciones)
-- Supabase da EXECUTE por defecto a anon/authenticated sobre funciones
-- nuevas; aquí se revoca todo y se concede solo lo necesario.
-- =====================================================================
revoke all on all functions in schema public from anon, authenticated, public;

-- Web (anónimo)
grant execute on function public.menu_publico()                 to anon, authenticated;
grant execute on function public.crear_pedido_web(jsonb, jsonb) to anon, authenticated;
grant execute on function public.app_info()                     to anon, authenticated;

-- Personal (cada función verifica es_staff() por dentro)
grant execute on function public.es_staff()                                                  to authenticated;
grant execute on function public.perfil_actual()                                             to authenticated;
grant execute on function public.menu_admin()                                                to authenticated;
grant execute on function public.categoria_guardar(jsonb)                                    to authenticated;
grant execute on function public.categoria_eliminar(uuid)                                    to authenticated;
grant execute on function public.producto_guardar(jsonb)                                     to authenticated;
grant execute on function public.producto_eliminar(uuid)                                     to authenticated;
grant execute on function public.ajustes_guardar(jsonb)                                      to authenticated;
grant execute on function public.pedidos_listar(date, date, public.estado_pedido[], text)    to authenticated;
grant execute on function public.pedido_cambiar_estado(uuid, public.estado_pedido, text)     to authenticated;
grant execute on function public.pedido_actualizar_cobro(uuid, jsonb)                        to authenticated;
grant execute on function public.venta_registrar(jsonb, jsonb)                               to authenticated;
grant execute on function public.reporte_ventas(date, date, text)                            to authenticated;


-- >>>>>>>>>> 20261106000006_supabase.sql
-- =====================================================================
-- Quechimba Burger · 06 · Servicios de Supabase
-- Realtime (pedidos en vivo) y Storage (fotos del menú).
-- Protegido con comprobaciones para poder ejecutar los tests fuera de Supabase.
-- =====================================================================

-- Realtime: la app de escritorio escucha cambios en pedidos (respeta RLS)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.pedidos;
  end if;
end
$$;

-- Storage: bucket público de fotos del menú; solo el personal sube/borra
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage')
     and exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then

    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('productos', 'productos', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
    on conflict (id) do nothing;

    execute $p$
      create policy "fotos_productos_lectura" on storage.objects
        for select to anon, authenticated using (bucket_id = 'productos')
    $p$;
    execute $p$
      create policy "fotos_productos_subir" on storage.objects
        for insert to authenticated with check (bucket_id = 'productos' and public.es_staff())
    $p$;
    execute $p$
      create policy "fotos_productos_actualizar" on storage.objects
        for update to authenticated using (bucket_id = 'productos' and public.es_staff())
    $p$;
    execute $p$
      create policy "fotos_productos_borrar" on storage.objects
        for delete to authenticated using (bucket_id = 'productos' and public.es_staff())
    $p$;
  end if;
end
$$;


-- >>>>>>>>>> 20261107000007_web_en_vivo.sql
-- =====================================================================
-- Quechimba Burger · 07 · Web en vivo y foto del destacado
-- 1) Cuando cambia el menú o los ajustes, la base de datos avisa a la web
--    por un canal público de Supabase Realtime ("menu-publico") y la web se
--    actualiza sola, sin recargar. El aviso NO lleva datos (la web vuelve a
--    pedir menu_publico, que respeta todas las reglas de seguridad).
-- 2) Al cambiar el producto destacado se usa la foto del producto nuevo.
-- Segura de ejecutar más de una vez.
-- =====================================================================

-- ---------- 1) Aviso en vivo ----------
create or replace function public.tg_avisar_cambio_menu()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Solo existe en Supabase; en otras bases (pruebas) simplemente no avisa.
  if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null then
    begin
      perform realtime.send(jsonb_build_object('tabla', tg_table_name), 'menu-cambio', 'menu-publico', false);
    exception when others then
      -- Un fallo del aviso jamás debe impedir guardar el menú o los ajustes
      raise warning 'No se pudo avisar el cambio del menú: %', sqlerrm;
    end;
  end if;
  return null;
end
$$;

revoke all on function public.tg_avisar_cambio_menu() from public, anon, authenticated;

drop trigger if exists avisar_cambio_productos on public.productos;
create trigger avisar_cambio_productos
after insert or update or delete on public.productos
for each statement execute function public.tg_avisar_cambio_menu();

drop trigger if exists avisar_cambio_categorias on public.categorias;
create trigger avisar_cambio_categorias
after insert or update or delete on public.categorias
for each statement execute function public.tg_avisar_cambio_menu();

drop trigger if exists avisar_cambio_ajustes on public.ajustes;
create trigger avisar_cambio_ajustes
after update on public.ajustes
for each statement execute function public.tg_avisar_cambio_menu();

-- ---------- 2) Foto del destacado ----------
-- Antes: al elegir otro producto se conservaba la foto especial del anterior.
-- Ahora: si cambia el producto y no se envía una foto especial, se usa la del producto.
create or replace function public.ajustes_guardar(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fila public.ajustes%rowtype;
  v_dest uuid;
  v_ver  text;
  v_foto text;
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

  v_foto := case
    when p ? 'foto_destacado_url' then nullif(public._texto(p, 'foto_destacado_url', 2000000), '')
    when v_dest is distinct from v_fila.producto_destacado_id then null   -- cambió el producto: su propia foto
    else v_fila.foto_destacado_url
  end;

  v_ver := case when p ? 'version_minima_escritorio' then public._texto(p, 'version_minima_escritorio', 20, true)
                else v_fila.version_minima_escritorio end;
  if v_ver !~ '^\d+\.\d+\.\d+$' then
    perform public._error('DATO_INVALIDO', 'La versión debe tener el formato 1.2.3');
  end if;

  update public.ajustes set
    pedidos_web_activos       = public._booleano(p, 'pedidos_web_activos', v_fila.pedidos_web_activos),
    producto_destacado_id     = v_dest,
    titulo_destacado          = case when p ? 'titulo_destacado' then public._texto(p, 'titulo_destacado', 40) else v_fila.titulo_destacado end,
    foto_destacado_url        = v_foto,
    url_sitio                 = case when p ? 'url_sitio' then public._texto(p, 'url_sitio', 300) else v_fila.url_sitio end,
    version_minima_escritorio = v_ver
  where id = 1
  returning * into v_fila;
  return to_jsonb(v_fila) - 'id';
end
$$;

revoke all on function public.ajustes_guardar(jsonb) from public, anon;
grant execute on function public.ajustes_guardar(jsonb) to authenticated;

-- Corrige el estado actual: si el destacado ya no es la salchipapa original,
-- se quita la foto especial que había quedado pegada.
update public.ajustes
   set foto_destacado_url = null
 where id = 1
   and foto_destacado_url = 'assets/img/promo-salchipapa.webp'
   and producto_destacado_id is distinct from (select id from public.productos where slug = 'salchipapa-de-nivel');


-- >>>>>>>>>> 20261107000008_festividades.sql
-- =====================================================================
-- Quechimba Burger · 08 · Festividades y aniversario
-- • El dueño elige en la app un tema de temporada (Halloween, Navidad…)
--   y la web cambia colores, adornos e ícono al instante (aviso de la 07).
-- • Cada festividad tiene 3 diseños: por defecto rotan solos cada año
--   (o el dueño fija uno).
-- • Aniversario: se registra UNA vez (día, mes y qué número de aniversario
--   es este año). Desde entonces, cada año, ese día y los 6 siguientes la
--   web se pone de aniversario SOLA, con el número correcto.
-- Fechas siempre en hora de Colombia. Segura de ejecutar más de una vez.
-- =====================================================================

alter table public.ajustes add column if not exists tema text not null default 'normal';
alter table public.ajustes add column if not exists tema_variante smallint;
alter table public.ajustes add column if not exists aniversario_dia smallint;
alter table public.ajustes add column if not exists aniversario_mes smallint;
alter table public.ajustes add column if not exists aniversario_fundacion int;

alter table public.ajustes drop constraint if exists ajustes_tema_valido;
alter table public.ajustes add constraint ajustes_tema_valido check (tema in (
  'normal', 'amor_amistad', 'halloween', 'dia_muertos', 'navidad', 'ano_nuevo',
  'dia_madre', 'dia_padre', 'fiestas_patrias', 'festival_vallenato', 'aniversario'
));
alter table public.ajustes drop constraint if exists ajustes_variante_valida;
alter table public.ajustes add constraint ajustes_variante_valida check (tema_variante is null or tema_variante between 1 and 3);
alter table public.ajustes drop constraint if exists ajustes_aniversario_completo;
alter table public.ajustes add constraint ajustes_aniversario_completo check (
  (aniversario_dia is null and aniversario_mes is null and aniversario_fundacion is null)
  or (aniversario_dia between 1 and 31 and aniversario_mes between 1 and 12 and aniversario_fundacion between 1800 and 3000)
);

-- Duración de la celebración automática del aniversario (días, incluido el día del aniversario)
create or replace function public._dias_aniversario() returns int language sql immutable as $$ select 7 $$;

-- Fecha del aniversario en un año dado (29 de febrero → 28 en años no bisiestos)
create or replace function public._fecha_aniversario(p_anio int, p_mes int, p_dia int)
returns date
language sql
immutable
as $$
  select make_date(p_anio, p_mes,
    least(p_dia, extract(day from (make_date(p_anio, p_mes, 1) + interval '1 month - 1 day'))::int))
$$;

-- ¿Qué tema muestra la web HOY? (el aniversario automático tiene prioridad en su semana)
-- Devuelve { tema, variante, numero (solo aniversario), automatico }
create or replace function public._tema_efectivo(p_hoy date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  a        public.ajustes%rowtype;
  v_hoy    date := coalesce(p_hoy, (now() at time zone 'America/Bogota')::date);
  v_anio   int  := extract(year from v_hoy)::int;
  v_dias   int  := public._dias_aniversario();
  f_este   date;
  f_ant    date;
  v_num    int;
  v_auto   boolean := false;
  v_tema   text;
begin
  select * into a from public.ajustes where id = 1;
  v_tema := a.tema;

  if a.aniversario_mes is not null then
    f_este := public._fecha_aniversario(v_anio, a.aniversario_mes, a.aniversario_dia);
    f_ant  := public._fecha_aniversario(v_anio - 1, a.aniversario_mes, a.aniversario_dia);
    if v_hoy >= f_este and v_hoy < f_este + v_dias then
      v_num := v_anio - a.aniversario_fundacion;           -- semana del aniversario de este año
      v_auto := v_num >= 1;
    elsif v_hoy >= f_ant and v_hoy < f_ant + v_dias then
      v_num := v_anio - 1 - a.aniversario_fundacion;       -- semana que empezó a fin del año anterior
      v_auto := v_num >= 1;
    elsif v_hoy >= f_este then
      v_num := v_anio - a.aniversario_fundacion;           -- último aniversario: este año
    else
      v_num := v_anio - 1 - a.aniversario_fundacion;       -- último aniversario: el año pasado
    end if;
    if v_num < 1 then v_num := v_num + 1; end if;          -- aún no cumple el primero: se muestra el que viene
  end if;

  if v_auto then
    v_tema := 'aniversario';
  elsif v_tema = 'aniversario' and a.aniversario_mes is null then
    v_tema := 'normal';                                     -- sin fecha registrada no hay aniversario
  end if;

  return jsonb_build_object(
    'tema', v_tema,
    'variante', case
      when v_tema = 'normal' then null
      when a.tema_variante is not null and not v_auto then a.tema_variante
      when v_tema = 'aniversario' then (v_num % 3) + 1      -- cada aniversario, un diseño distinto
      else (v_anio % 3) + 1                                 -- cada año, un diseño distinto
    end,
    'numero', case when v_tema = 'aniversario' then v_num end,
    'automatico', v_auto
  );
end
$$;

-- ---------- Menú público: incluye la festividad de hoy ----------
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

-- ---------- Guardar ajustes: tema, diseño y aniversario ----------
-- p admite además: tema, tema_variante (1-3 o null = automático),
-- aniversario: { dia, mes, numero } (numero = qué aniversario es ESTE año) o null para borrarlo.
create or replace function public.ajustes_guardar(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fila  public.ajustes%rowtype;
  v_dest  uuid;
  v_ver   text;
  v_foto  text;
  v_tema  text;
  v_var   smallint;
  v_adia  smallint;
  v_ames  smallint;
  v_afund int;
  v_anio  int := extract(year from (now() at time zone 'America/Bogota'))::int;
begin
  perform public._requiere_staff();
  select * into v_fila from public.ajustes where id = 1;

  -- Producto destacado
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

  v_foto := case
    when p ? 'foto_destacado_url' then nullif(public._texto(p, 'foto_destacado_url', 2000000), '')
    when v_dest is distinct from v_fila.producto_destacado_id then null   -- cambió el producto: su propia foto
    else v_fila.foto_destacado_url
  end;

  v_ver := case when p ? 'version_minima_escritorio' then public._texto(p, 'version_minima_escritorio', 20, true)
                else v_fila.version_minima_escritorio end;
  if v_ver !~ '^\d+\.\d+\.\d+$' then
    perform public._error('DATO_INVALIDO', 'La versión debe tener el formato 1.2.3');
  end if;

  -- Aniversario
  v_adia := v_fila.aniversario_dia;
  v_ames := v_fila.aniversario_mes;
  v_afund := v_fila.aniversario_fundacion;
  if p ? 'aniversario' then
    if jsonb_typeof(p -> 'aniversario') = 'null' then
      v_adia := null; v_ames := null; v_afund := null;
    elsif jsonb_typeof(p -> 'aniversario') = 'object' then
      v_adia := public._entero(p -> 'aniversario', 'dia', 1, 31);
      v_ames := public._entero(p -> 'aniversario', 'mes', 1, 12);
      begin
        perform make_date(2000, v_ames, v_adia);   -- 2000 es bisiesto: admite el 29 de febrero
      exception when others then
        perform public._error('DATO_INVALIDO', 'Esa fecha no existe');
      end;
      v_afund := v_anio - public._entero(p -> 'aniversario', 'numero', 1, 200);
    else
      perform public._error('DATO_INVALIDO', 'Datos del aniversario inválidos');
    end if;
  end if;

  -- Tema y diseño
  v_tema := case when p ? 'tema' then public._texto(p, 'tema', 30, true) else v_fila.tema end;
  if v_tema not in ('normal', 'amor_amistad', 'halloween', 'dia_muertos', 'navidad', 'ano_nuevo',
                    'dia_madre', 'dia_padre', 'fiestas_patrias', 'festival_vallenato', 'aniversario') then
    perform public._error('DATO_INVALIDO', 'Festividad no válida');
  end if;
  if v_ames is null and v_tema = 'aniversario' and not (p ? 'tema') then
    v_tema := 'normal';                                   -- se borró la fecha: se quita el tema
  end if;
  if v_tema = 'aniversario' and v_ames is null then
    perform public._error('ANIVERSARIO_SIN_FECHA', 'Primero registra la fecha del aniversario');
  end if;

  if p ? 'tema_variante' then
    v_var := case when jsonb_typeof(p -> 'tema_variante') = 'null' then null
                  else public._entero(p, 'tema_variante', 1, 3) end;
  elsif p ? 'tema' and v_tema is distinct from v_fila.tema then
    v_var := null;                                        -- otra festividad: diseño automático
  else
    v_var := v_fila.tema_variante;
  end if;

  update public.ajustes set
    pedidos_web_activos       = public._booleano(p, 'pedidos_web_activos', v_fila.pedidos_web_activos),
    producto_destacado_id     = v_dest,
    titulo_destacado          = case when p ? 'titulo_destacado' then public._texto(p, 'titulo_destacado', 40) else v_fila.titulo_destacado end,
    foto_destacado_url        = v_foto,
    url_sitio                 = case when p ? 'url_sitio' then public._texto(p, 'url_sitio', 300) else v_fila.url_sitio end,
    version_minima_escritorio = v_ver,
    tema                      = v_tema,
    tema_variante             = v_var,
    aniversario_dia           = v_adia,
    aniversario_mes           = v_ames,
    aniversario_fundacion     = v_afund
  where id = 1
  returning * into v_fila;
  return (to_jsonb(v_fila) - 'id') || jsonb_build_object('festividad', public._tema_efectivo());
end
$$;

-- ---------- Permisos ----------
revoke all on function public._dias_aniversario() from public, anon, authenticated;
revoke all on function public._fecha_aniversario(int, int, int) from public, anon, authenticated;
revoke all on function public._tema_efectivo(date) from public, anon, authenticated;
revoke all on function public.menu_publico() from public;
grant execute on function public.menu_publico() to anon, authenticated;
revoke all on function public.ajustes_guardar(jsonb) from public, anon;
grant execute on function public.ajustes_guardar(jsonb) to authenticated;


-- >>>>>>>>>> 20261108000009_pagos_nequi_efectivo.sql
-- =====================================================================
-- Quechimba Burger · 09 · Solo Nequi y efectivo
-- El negocio recibe pagos únicamente por Nequi o en efectivo.
-- • Ningún pedido NUEVO (web, WhatsApp o local) puede usar otro método.
-- • Cambiar el método de un pedido existente a otro que no sea Nequi o
--   efectivo tampoco se permite.
-- • Los pedidos viejos que ya tengan Daviplata, transferencia, etc. se
--   conservan intactos (la contabilidad histórica no cambia) y se pueden
--   seguir gestionando mientras no se les cambie el método.
-- Segura de ejecutar más de una vez.
-- =====================================================================

create or replace function public.tg_pago_permitido()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.metodo_pago not in ('efectivo', 'nequi')
     and (tg_op = 'INSERT' or new.metodo_pago is distinct from old.metodo_pago) then
    raise exception 'Solo se aceptan pagos por Nequi o en efectivo'
      using errcode = 'P0001', hint = 'DATO_INVALIDO';
  end if;
  return new;
end;
$$;

revoke all on function public.tg_pago_permitido() from public, anon, authenticated;

drop trigger if exists tg_pago_permitido on public.pedidos;
create trigger tg_pago_permitido
before insert or update of metodo_pago on public.pedidos
for each row execute function public.tg_pago_permitido();


-- >>>>>>>>>> seed.sql
-- =====================================================================
-- Quechimba Burger · Datos iniciales del menú
-- Copia del menú que hoy tiene la web. Ejecutar UNA vez después de las
-- migraciones. Precios y descripciones: PENDIENTE confirmar con el negocio.
-- =====================================================================

insert into public.categorias (slug, nombre, orden) values
  ('hamburguesas', 'Hamburguesas', 1),
  ('salchipapas',  'Salchipapas',  2),
  ('combos',       'Combos',       3),
  ('perros',       'Perros',       4),
  ('acompanantes', 'Para picar',   5),
  ('bebidas',      'Bebidas',      6);

insert into public.productos (slug, categoria_id, nombre, descripcion, precio, etiqueta, foto_url, orden)
select v.slug, c.id, v.nombre, v.descripcion, v.precio, v.etiqueta, v.foto_url, v.orden
from (values
  ('clasica',          'hamburguesas', 'La Clásica',             'Carne de res de 150 g, queso cheddar, lechuga, tomate, cebolla y salsa de la casa en pan brioche.', 18000, null,             'https://images.unsplash.com/photo-1603064752734-4c48eff53d05', 1),
  ('quechimba',        'hamburguesas', 'La Quechimba',           'Nuestro pan sellado "Que Chimba", carne de res, tocineta, queso fundido y salsas de la casa.',   29000, 'Más pedida',     'assets/img/quechimba.webp', 2),
  ('costena',          'hamburguesas', 'La Costeña',             'Carne de res, queso costeño a la plancha, maduro, suero atollabuey y un toque de ají dulce.',   25000, 'De la casa',     'https://images.unsplash.com/photo-1596662951482-0c4ba74a6df6', 3),
  ('bbq-bacon',        'hamburguesas', 'BBQ Bacon',              'Carne de res, cheddar, tocineta, aros de cebolla y salsa BBQ ahumada.',                          26000, null,             'https://images.unsplash.com/photo-1598182198871-d3f4ab4fd181', 4),
  ('smash-doble',      'hamburguesas', 'Smash Doble',            'Dos carnes smash bien doradas, queso americano, pepinillos, cebolla y mostaza.',                 24000, 'Nueva',          'https://images.unsplash.com/photo-1607013251379-e6eecfffe234', 5),
  ('crispy-chicken',   'hamburguesas', 'Crispy Chicken',         'Pechuga apanada crocante, ensalada de repollo, pepinillos y mayonesa picante.',                  22000, 'Picante',        'https://images.unsplash.com/photo-1606755962773-d324e0a13086', 6),
  ('salchipapa-quechimba', 'salchipapas', 'Salchipapa Quechimba', 'Papas, salchicha, pollo, maíz tierno, queso rallado y salsas de la casa.',                     25000, 'La estrella',    'assets/img/salchipapa-quechimba.webp', 1),
  ('salchipapa-de-nivel',  'salchipapas', 'Salchipapa De Nivel',  'Bien cargada: chorizo, queso asado, papas, salchicha, queso rallado y salsas.',                 40000, 'Para compartir', 'assets/img/salchipapa-de-nivel.webp', 2),
  ('salchipapa-familiar',  'salchipapas', 'Salchipapa Familiar',  'Bandeja grande con papas, salchicha, queso asado, gratinado y salsas de la casa.',               60000, null,             'assets/img/salchipapa-familiar.webp', 3),
  ('combo-quechimba',  'combos',       'Combo Quechimba',        'La Quechimba + papas francesas + bebida a elección.',                                            38000, 'Ahorras $5.000', 'https://images.unsplash.com/photo-1561758033-d89a9ad46330', 1),
  ('combo-clasico',    'combos',       'Combo Clásico',          'La Clásica + papas francesas + bebida a elección.',                                              27000, null,             'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5', 2),
  ('combo-x4',         'combos',       'Combo x4',               '4 hamburguesas, papas para compartir y gaseosa de 1,5 L.',                                       85000, 'Para 4',         'https://images.unsplash.com/photo-1610614819513-58e34989848b', 3),
  ('perro-clasico',    'perros',       'Perro Clásico',          'Salchicha americana, cebolla, papita ripio, queso rallado y salsas.',                            12000, null,             'https://images.unsplash.com/photo-1599599810694-b5b37304c041', 1),
  ('perro-quechimba',  'perros',       'Perro Quechimba',        'Salchicha de res, tocineta, queso gratinado, maíz tierno y pico de gallo.',                      18000, 'Más pedido',     'https://images.unsplash.com/photo-1619740455993-9e612b1af08a', 2),
  ('perro-ranchero',   'perros',       'Perro Ranchero',         'Salchicha ranchera, cebollín, queso mozzarella y salsa de ajo.',                                 15000, null,             'https://images.unsplash.com/photo-1613482084286-41f25b486fa2', 3),
  ('papas-francesas',  'acompanantes', 'Papas francesas',        'Porción de papas crocantes con la sal de la casa.',                                              7000,  null,             'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d', 1),
  ('papas-queso',      'acompanantes', 'Papas con queso y tocineta', 'Papas francesas bañadas en cheddar fundido y tocineta picada.',                              14000, null,             'https://images.unsplash.com/photo-1573080496219-bb080dd4f877', 2),
  ('aros-cebolla',     'acompanantes', 'Aros de cebolla',        'Aros apanados y crocantes con salsa de la casa para untar.',                                     9000,  null,             'https://images.unsplash.com/photo-1639024471283-03518883512d', 3),
  ('limonada',         'bebidas',      'Limonada de hierbabuena','Limón natural, hierbabuena fresca y mucho hielo.',                                               7000,  null,             'https://images.unsplash.com/photo-1621263764928-df1444c5e859', 1),
  ('jugo-mango',       'bebidas',      'Jugo de mango',          'Jugo natural en agua o en leche.',                                                               7000,  null,             'https://images.unsplash.com/photo-1546173159-315724a31696', 2),
  ('malteada-cookies', 'bebidas',      'Malteada cookies & cream','Helado de vainilla, galleta de chocolate triturada y crema batida.',                            13000, null,             'https://images.unsplash.com/photo-1572490122747-3968b75cc699', 3),
  ('malteada-fresa',   'bebidas',      'Malteada de fresa',      'Fresas naturales, helado de vainilla y crema batida.',                                           12000, null,             'https://images.unsplash.com/photo-1579954115545-a95591f28bfc', 4),
  ('te-helado',        'bebidas',      'Té helado de limón',     'Preparado en casa, bien frío.',                                                                  6000,  null,             'https://images.unsplash.com/photo-1556679343-c7306c1976bc', 5)
) as v (slug, cat, nombre, descripcion, precio, etiqueta, foto_url, orden)
join public.categorias c on c.slug = v.cat;

-- Producto destacado de la web y dirección del sitio (para ver fotos locales desde la app)
update public.ajustes set
  producto_destacado_id = (select id from public.productos where slug = 'salchipapa-de-nivel'),
  titulo_destacado      = 'La estrella de la casa',
  foto_destacado_url    = 'assets/img/promo-salchipapa.webp',
  url_sitio             = 'https://raw.githubusercontent.com/danteruedas123-glitch/QueChimbaBurguer/web/'
where id = 1;

