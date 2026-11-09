-- =====================================================================
-- Quechimba Burger · 11 · Solo transferencia y efectivo
-- El negocio ahora recibe pagos por transferencia o en efectivo (reemplaza
-- a Nequi de la migración 09).
-- • Ningún pedido NUEVO puede usar otro método, ni se puede cambiar el
--   método de un pedido a otro que no sea transferencia o efectivo.
-- • Los pedidos viejos (por ejemplo los pagados por Nequi) se conservan
--   intactos y la contabilidad histórica no cambia.
-- Segura de ejecutar más de una vez.
-- =====================================================================

create or replace function public.tg_pago_permitido()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.metodo_pago not in ('efectivo', 'transferencia')
     and (tg_op = 'INSERT' or new.metodo_pago is distinct from old.metodo_pago) then
    raise exception 'Solo se aceptan pagos por transferencia o en efectivo'
      using errcode = 'P0001', hint = 'DATO_INVALIDO';
  end if;
  return new;
end;
$$;

revoke all on function public.tg_pago_permitido() from public, anon, authenticated;
