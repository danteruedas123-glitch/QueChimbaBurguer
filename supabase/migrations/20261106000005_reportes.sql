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
