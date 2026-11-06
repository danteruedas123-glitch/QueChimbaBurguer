-- =====================================================================
-- Quechimba Burger · 08 · Festividades y aniversario
-- • El dueño elige en la app un tema de temporada (Halloween, Navidad…)
--   y la web cambia colores, adornos e ícono al instante (aviso de la 07).
-- • Cada festividad tiene 3 diseños: por defecto rotan solos cada año
--   (o el dueño fija uno).
-- • Aniversario: se registra UNA vez (día, mes y qué número de aniversario
--   es este año). Desde entonces, cada año, ese día y los 6 siguientes la
--   web se pone de aniversario SOLA, con el número correcto.
-- Fechas siempre en hora de Colombia. Segura de ejecutar más de una vez.
-- =====================================================================

alter table public.ajustes add column if not exists tema text not null default 'normal';
alter table public.ajustes add column if not exists tema_variante smallint;
alter table public.ajustes add column if not exists aniversario_dia smallint;
alter table public.ajustes add column if not exists aniversario_mes smallint;
alter table public.ajustes add column if not exists aniversario_fundacion int;

alter table public.ajustes drop constraint if exists ajustes_tema_valido;
alter table public.ajustes add constraint ajustes_tema_valido check (tema in (
  'normal', 'amor_amistad', 'halloween', 'dia_muertos', 'navidad', 'ano_nuevo',
  'dia_madre', 'dia_padre', 'fiestas_patrias', 'festival_vallenato', 'aniversario'
));
alter table public.ajustes drop constraint if exists ajustes_variante_valida;
alter table public.ajustes add constraint ajustes_variante_valida check (tema_variante is null or tema_variante between 1 and 3);
alter table public.ajustes drop constraint if exists ajustes_aniversario_completo;
alter table public.ajustes add constraint ajustes_aniversario_completo check (
  (aniversario_dia is null and aniversario_mes is null and aniversario_fundacion is null)
  or (aniversario_dia between 1 and 31 and aniversario_mes between 1 and 12 and aniversario_fundacion between 1800 and 3000)
);

-- Duración de la celebración automática del aniversario (días, incluido el día del aniversario)
create or replace function public._dias_aniversario() returns int language sql immutable as $$ select 7 $$;

-- Fecha del aniversario en un año dado (29 de febrero → 28 en años no bisiestos)
create or replace function public._fecha_aniversario(p_anio int, p_mes int, p_dia int)
returns date
language sql
immutable
as $$
  select make_date(p_anio, p_mes,
    least(p_dia, extract(day from (make_date(p_anio, p_mes, 1) + interval '1 month - 1 day'))::int))
$$;

-- ¿Qué tema muestra la web HOY? (el aniversario automático tiene prioridad en su semana)
-- Devuelve { tema, variante, numero (solo aniversario), automatico }
create or replace function public._tema_efectivo(p_hoy date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  a        public.ajustes%rowtype;
  v_hoy    date := coalesce(p_hoy, (now() at time zone 'America/Bogota')::date);
  v_anio   int  := extract(year from v_hoy)::int;
  v_dias   int  := public._dias_aniversario();
  f_este   date;
  f_ant    date;
  v_num    int;
  v_auto   boolean := false;
  v_tema   text;
begin
  select * into a from public.ajustes where id = 1;
  v_tema := a.tema;

  if a.aniversario_mes is not null then
    f_este := public._fecha_aniversario(v_anio, a.aniversario_mes, a.aniversario_dia);
    f_ant  := public._fecha_aniversario(v_anio - 1, a.aniversario_mes, a.aniversario_dia);
    if v_hoy >= f_este and v_hoy < f_este + v_dias then
      v_num := v_anio - a.aniversario_fundacion;           -- semana del aniversario de este año
      v_auto := v_num >= 1;
    elsif v_hoy >= f_ant and v_hoy < f_ant + v_dias then
      v_num := v_anio - 1 - a.aniversario_fundacion;       -- semana que empezó a fin del año anterior
      v_auto := v_num >= 1;
    elsif v_hoy >= f_este then
      v_num := v_anio - a.aniversario_fundacion;           -- último aniversario: este año
    else
      v_num := v_anio - 1 - a.aniversario_fundacion;       -- último aniversario: el año pasado
    end if;
    if v_num < 1 then v_num := v_num + 1; end if;          -- aún no cumple el primero: se muestra el que viene
  end if;

  if v_auto then
    v_tema := 'aniversario';
  elsif v_tema = 'aniversario' and a.aniversario_mes is null then
    v_tema := 'normal';                                     -- sin fecha registrada no hay aniversario
  end if;

  return jsonb_build_object(
    'tema', v_tema,
    'variante', case
      when v_tema = 'normal' then null
      when a.tema_variante is not null and not v_auto then a.tema_variante
      when v_tema = 'aniversario' then (v_num % 3) + 1      -- cada aniversario, un diseño distinto
      else (v_anio % 3) + 1                                 -- cada año, un diseño distinto
    end,
    'numero', case when v_tema = 'aniversario' then v_num end,
    'automatico', v_auto
  );
end
$$;

-- ---------- Menú público: incluye la festividad de hoy ----------
create or replace function public.menu_publico()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with prods as (
    select p.*, c.slug as cat_slug, c.orden as cat_orden
    from public.productos p
    join public.categorias c on c.id = p.categoria_id
    where p.activo and c.activa
  )
  select jsonb_build_object(
    'pedidos_web_activos', a.pedidos_web_activos,
    'festividad', public._tema_efectivo(),
    'destacado', (
      select jsonb_build_object('producto', d.slug, 'titulo', a.titulo_destacado, 'foto_url', a.foto_destacado_url)
      from prods d where d.id = a.producto_destacado_id
    ),
    'categorias', coalesce((
      select jsonb_agg(jsonb_build_object('slug', c.slug, 'nombre', c.nombre) order by c.orden, c.nombre)
      from public.categorias c
      where c.activa and exists (select 1 from prods p where p.categoria_id = c.id)
    ), '[]'::jsonb),
    'productos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', p.slug, 'categoria', p.cat_slug, 'nombre', p.nombre, 'descripcion', p.descripcion,
        'precio', p.precio, 'etiqueta', p.etiqueta, 'foto_url', p.foto_url, 'agotado', p.agotado
      ) order by p.cat_orden, p.orden, p.nombre)
      from prods p
    ), '[]'::jsonb)
  )
  from public.ajustes a
  where a.id = 1
$$;

-- ---------- Guardar ajustes: tema, diseño y aniversario ----------
-- p admite además: tema, tema_variante (1-3 o null = automático),
-- aniversario: { dia, mes, numero } (numero = qué aniversario es ESTE año) o null para borrarlo.
create or replace function public.ajustes_guardar(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fila  public.ajustes%rowtype;
  v_dest  uuid;
  v_ver   text;
  v_foto  text;
  v_tema  text;
  v_var   smallint;
  v_adia  smallint;
  v_ames  smallint;
  v_afund int;
  v_anio  int := extract(year from (now() at time zone 'America/Bogota'))::int;
begin
  perform public._requiere_staff();
  select * into v_fila from public.ajustes where id = 1;

  -- Producto destacado
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

  -- Aniversario
  v_adia := v_fila.aniversario_dia;
  v_ames := v_fila.aniversario_mes;
  v_afund := v_fila.aniversario_fundacion;
  if p ? 'aniversario' then
    if jsonb_typeof(p -> 'aniversario') = 'null' then
      v_adia := null; v_ames := null; v_afund := null;
    elsif jsonb_typeof(p -> 'aniversario') = 'object' then
      v_adia := public._entero(p -> 'aniversario', 'dia', 1, 31);
      v_ames := public._entero(p -> 'aniversario', 'mes', 1, 12);
      begin
        perform make_date(2000, v_ames, v_adia);   -- 2000 es bisiesto: admite el 29 de febrero
      exception when others then
        perform public._error('DATO_INVALIDO', 'Esa fecha no existe');
      end;
      v_afund := v_anio - public._entero(p -> 'aniversario', 'numero', 1, 200);
    else
      perform public._error('DATO_INVALIDO', 'Datos del aniversario inválidos');
    end if;
  end if;

  -- Tema y diseño
  v_tema := case when p ? 'tema' then public._texto(p, 'tema', 30, true) else v_fila.tema end;
  if v_tema not in ('normal', 'amor_amistad', 'halloween', 'dia_muertos', 'navidad', 'ano_nuevo',
                    'dia_madre', 'dia_padre', 'fiestas_patrias', 'festival_vallenato', 'aniversario') then
    perform public._error('DATO_INVALIDO', 'Festividad no válida');
  end if;
  if v_ames is null and v_tema = 'aniversario' and not (p ? 'tema') then
    v_tema := 'normal';                                   -- se borró la fecha: se quita el tema
  end if;
  if v_tema = 'aniversario' and v_ames is null then
    perform public._error('ANIVERSARIO_SIN_FECHA', 'Primero registra la fecha del aniversario');
  end if;

  if p ? 'tema_variante' then
    v_var := case when jsonb_typeof(p -> 'tema_variante') = 'null' then null
                  else public._entero(p, 'tema_variante', 1, 3) end;
  elsif p ? 'tema' and v_tema is distinct from v_fila.tema then
    v_var := null;                                        -- otra festividad: diseño automático
  else
    v_var := v_fila.tema_variante;
  end if;

  update public.ajustes set
    pedidos_web_activos       = public._booleano(p, 'pedidos_web_activos', v_fila.pedidos_web_activos),
    producto_destacado_id     = v_dest,
    titulo_destacado          = case when p ? 'titulo_destacado' then public._texto(p, 'titulo_destacado', 40) else v_fila.titulo_destacado end,
    foto_destacado_url        = v_foto,
    url_sitio                 = case when p ? 'url_sitio' then public._texto(p, 'url_sitio', 300) else v_fila.url_sitio end,
    version_minima_escritorio = v_ver,
    tema                      = v_tema,
    tema_variante             = v_var,
    aniversario_dia           = v_adia,
    aniversario_mes           = v_ames,
    aniversario_fundacion     = v_afund
  where id = 1
  returning * into v_fila;
  return (to_jsonb(v_fila) - 'id') || jsonb_build_object('festividad', public._tema_efectivo());
end
$$;

-- ---------- Permisos ----------
revoke all on function public._dias_aniversario() from public, anon, authenticated;
revoke all on function public._fecha_aniversario(int, int, int) from public, anon, authenticated;
revoke all on function public._tema_efectivo(date) from public, anon, authenticated;
revoke all on function public.menu_publico() from public;
grant execute on function public.menu_publico() to anon, authenticated;
revoke all on function public.ajustes_guardar(jsonb) from public, anon;
grant execute on function public.ajustes_guardar(jsonb) to authenticated;
