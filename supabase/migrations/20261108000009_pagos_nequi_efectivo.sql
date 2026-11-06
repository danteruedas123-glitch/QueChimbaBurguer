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
