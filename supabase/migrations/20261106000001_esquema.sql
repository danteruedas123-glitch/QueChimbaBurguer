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
