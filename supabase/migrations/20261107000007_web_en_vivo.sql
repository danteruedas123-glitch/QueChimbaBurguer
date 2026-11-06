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
