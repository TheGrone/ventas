-- ============================================================================
-- MIGRACIÓN V2 (Ejecuta esto en Supabase SQL Editor si ya corriste schema.sql)
-- Agrega:
--   1. Múltiples códigos de invitación creables/eliminables (invite_codes)
--   2. Hasta 6 imágenes por producto (products.images)
--   3. Categorías iniciales por si faltaron
-- ============================================================================

-- 1. Asegurar categorías iniciales
insert into public.categories (name, icon, sort_order) values
  ('Alimentos y Comida', 'utensils', 1),
  ('Postres y Panadería', 'cake', 2),
  ('Ropa y Accesorios', 'shirt', 3),
  ('Hogar y Decoración', 'home', 4),
  ('Tecnología', 'smartphone', 5),
  ('Servicios y Clases', 'wrench', 6),
  ('Otros', 'package', 99)
on conflict (name) do nothing;

-- 2. Columna images (máx 6 fotos) en products
alter table public.products
  add column if not exists images text[] not null default '{}';

update public.products
set images = array[image_url]
where image_url is not null
  and image_url <> ''
  and coalesce(array_length(images, 1), 0) = 0;

alter table public.products
  drop constraint if exists chk_products_max_6_images;

alter table public.products
  add constraint chk_products_max_6_images
  check (coalesce(array_length(images, 1), 0) <= 6);

-- 3. Tabla de múltiples códigos de invitación
create table if not exists public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(trim(code)) between 3 and 40),
  label text not null default '',
  max_uses integer check (max_uses is null or max_uses > 0),
  uses_count integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.invite_codes enable row level security;

drop policy if exists "Solo admin gestiona invite_codes" on public.invite_codes;
create policy "Solo admin gestiona invite_codes"
  on public.invite_codes for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Permisos de tabla para authenticated (RLS sigue controlando quién accede)
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.categories to authenticated;
grant select, insert, update, delete on table public.products to authenticated;
grant select, insert, update, delete on table public.invite_codes to authenticated;
grant select, update on table public.condo_settings to authenticated;
grant select, insert on table public.moderation_logs to authenticated;

-- Insertar código inicial si no existe ninguno
insert into public.invite_codes (code, label, max_uses, is_active)
values ('CONDO2026', 'Código general inicial', null, true)
on conflict (code) do nothing;

-- 4. Actualizar trigger handle_new_user() para aceptar códigos de invite_codes o condo_settings
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite_code text;
  v_expected_code text;
  v_code_row public.invite_codes%rowtype;
  v_full_name text;
  v_unit text;
  v_whatsapp text;
begin
  v_invite_code := trim(coalesce(new.raw_user_meta_data->>'invite_code', ''));

  -- Buscar primero en invite_codes activos
  select * into v_code_row
  from public.invite_codes
  where upper(trim(code)) = upper(v_invite_code)
    and is_active = true
  limit 1;

  if found then
    if v_code_row.max_uses is not null and v_code_row.uses_count >= v_code_row.max_uses then
      raise exception 'Este código de invitación ya alcanzó su límite de usos.';
    end if;
    update public.invite_codes
    set uses_count = uses_count + 1
    where id = v_code_row.id;
  else
    -- Respaldo: revisar código general en condo_settings
    select invite_code into v_expected_code from public.condo_settings where id = 1;
    if v_expected_code is null or upper(v_invite_code) <> upper(trim(v_expected_code)) then
      raise exception 'Código de invitación del condominio inválido.';
    end if;
  end if;

  v_full_name := trim(coalesce(new.raw_user_meta_data->>'full_name', ''));
  v_unit := trim(coalesce(new.raw_user_meta_data->>'unit_number', ''));
  v_whatsapp := regexp_replace(coalesce(new.raw_user_meta_data->>'whatsapp', ''), '[^0-9+]', '', 'g');

  if char_length(v_full_name) < 2 then
    raise exception 'Debes ingresar tu nombre completo.';
  end if;
  if char_length(v_unit) < 1 then
    raise exception 'Debes ingresar tu torre y departamento.';
  end if;
  if v_whatsapp !~ '^\+?[0-9]{8,15}$' then
    raise exception 'Número de WhatsApp inválido. Ejemplo: +56912345678';
  end if;

  insert into public.profiles (id, email, full_name, unit_number, whatsapp, role, status)
  values (new.id, coalesce(new.email, ''), v_full_name, v_unit, v_whatsapp, 'resident', 'pending');

  return new;
end;
$$;
