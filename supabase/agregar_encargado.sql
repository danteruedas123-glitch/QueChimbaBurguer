-- =====================================================================
-- Quechimba Burger · AUTORIZAR A UN ENCARGADO EN LA APP
-- Ejecutar DESPUÉS de instalar_todo.sql y DESPUÉS de crear el usuario en
-- Supabase → Authentication → Users → Add user (marcar "Auto Confirm User").
--
-- 1) Cambia el correo y el nombre de abajo.
-- 2) Pega todo en Supabase → SQL Editor → Run.
-- 3) Debe aparecer una fila con el nombre, 'admin' y el correo.
-- =====================================================================

insert into public.staff (user_id, nombre, rol)
select id, '', 'admin'          -- ← CAMBIA el nombre
from auth.users
where email = lower('')   -- ← CAMBIA el correo
on conflict (user_id) do update set nombre = excluded.nombre, rol = excluded.rol;

-- Verificación: lista del personal autorizado
select s.nombre, s.rol, u.email
from public.staff s
join auth.users u on u.id = s.user_id;
