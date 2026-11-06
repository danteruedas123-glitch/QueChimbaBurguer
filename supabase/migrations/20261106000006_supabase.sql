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
