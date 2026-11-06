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
