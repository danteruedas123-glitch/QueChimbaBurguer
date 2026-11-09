-- =====================================================================
-- Quechimba Burger · 12 · Límites de dinero en los pedidos
-- Hallazgos de las pruebas de estrés:
-- • Un producto con opciones de extras enormes podía pasar el precio máximo
--   ($5.000.000) y el cliente recibía un error técnico. Ahora: mensaje claro.
-- • Un pedido de 40 productos caros × 99 unidades desbordaba el total (int).
--   Ahora se calcula en bigint y se rechaza por encima de $100.000.000.
-- • El tablero de pedidos traía máximo 1.000 (los más nuevos): en un día de
--   locos, los pendientes MÁS VIEJOS (los más urgentes) podían desaparecer.
--   Ahora los pendientes salen siempre todos; el tope es solo para los cerrados.
-- Segura de ejecutar más de una vez.
-- =====================================================================

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
  v_suma  bigint := 0;            -- total del pedido, en bigint para no desbordar
  v_unit  bigint;
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
    v_unit := v_prod.precio::bigint + (v_linea ->> 'extra')::bigint;
    if v_unit > 5000000 then
      perform public._error('DATO_INVALIDO', format('El precio de "%s" con sus opciones supera el máximo permitido', v_prod.nombre));
    end if;
    v_suma := v_suma + v_unit * v_cant;
    if v_suma > 100000000 then
      perform public._error('DATO_INVALIDO', 'El pedido supera el valor máximo permitido ($100.000.000)');
    end if;
    select nombre into v_cat from public.categorias where id = v_prod.categoria_id;
    insert into public.pedido_items (pedido_id, producto_id, nombre_producto, categoria_nombre, precio_unitario, cantidad, detalle)
    values (p_pedido, v_prod.id, v_prod.nombre, coalesce(v_cat, ''), v_prod.precio + (v_linea ->> 'extra')::int, v_cant, v_linea ->> 'detalle');
  end loop;
end
$$;

-- ---------- Pedidos del tablero: los pendientes nunca se pierden por el tope ----------
create or replace function public.pedidos_listar(p_desde date, p_hasta date, p_estados public.estado_pedido[] default null, p_tz text default 'America/Bogota')
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
      (select id, creado_en from public.pedidos
        where creado_en >= (p_desde::timestamp at time zone p_tz)
          and creado_en <  ((p_hasta + 1)::timestamp at time zone p_tz)
          and estado in ('nuevo', 'preparando', 'listo')
          and (p_estados is null or estado = any (p_estados))
        order by creado_en
        limit 5000)
      union all
      (select id, creado_en from public.pedidos
        where creado_en >= (p_desde::timestamp at time zone p_tz)
          and creado_en <  ((p_hasta + 1)::timestamp at time zone p_tz)
          and estado in ('entregado', 'cancelado')
          and (p_estados is null or estado = any (p_estados))
        order by creado_en desc
        limit 1000)
    ) x
  ), '[]'::jsonb);
end
$$;
