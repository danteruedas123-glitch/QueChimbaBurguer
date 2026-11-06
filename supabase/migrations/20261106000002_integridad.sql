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
