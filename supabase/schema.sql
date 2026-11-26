-- ============================================================================
-- CONDOMARKET - Esquema completo y políticas de seguridad (RLS) para Supabase
-- Ejecuta este archivo en el SQL Editor de tu proyecto Supabase.
-- ============================================================================

-- 1. Extensiones necesarias
create extension if not exists "pgcrypto";

-- 2. Configuración privada del condominio (solo accesible por Admin y Triggers)
create table if not exists public.condo_settings (
  id integer primary key default 1 check (id = 1),
  condo_name text not null default 'Mi Condominio',
  invite_code text not null default 'CONDO2026',
  updated_at timestamptz not null default now()
);

insert into public.condo_settings (id, condo_name, invite_code)
values (1, 'Mi Condominio', 'CONDO2026')
on conflict (id) do nothing;

alter table public.condo_settings enable row level security;

-- 3. Perfiles de vecinos (vinculados 1:1 con auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null check (char_length(trim(full_name)) between 2 and 80),
  unit_number text not null check (char_length(trim(unit_number)) between 1 and 30),
  whatsapp text not null check (whatsapp ~ '^\+?[0-9]{8,15}$'),
  role text not null default 'resident' check (role in ('resident', 'admin')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Funciones auxiliares SECURITY DEFINER (evitan recursión en RLS)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and status = 'approved'
  );
$$;

create or replace function public.is_approved_resident()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and status = 'approved'
  );
$$;

-- Políticas de condo_settings (solo Admin puede leer/editar el código de invitación)
create policy "Solo admin lee settings"
  on public.condo_settings for select
  to authenticated
  using (public.is_admin());

create policy "Solo admin actualiza settings"
  on public.condo_settings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 4. Anti-suplantación: impedir que un usuario cambie su propio role o status
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Permitir cambios directos desde SQL Editor / service_role (auth.uid() is null)
  if auth.uid() is null then
    new.updated_at := now();
    return new;
  end if;

  -- Si no es admin, no puede modificar role, status ni email
  if not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'No tienes permisos para cambiar el rol.';
    end if;
    if new.status is distinct from old.status then
      raise exception 'No tienes permisos para cambiar el estado de aprobación.';
    end if;
    if new.email is distinct from old.email then
      raise exception 'No puedes modificar el correo directamente.';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_fields on public.profiles;
create trigger trg_protect_profile_fields
  before update on public.profiles
  for each row
  execute function public.protect_profile_fields();

-- 5. Tabla de códigos de invitación (múltiples códigos creables/eliminables)
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

create policy "Solo admin gestiona invite_codes"
  on public.invite_codes for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

insert into public.invite_codes (code, label, max_uses, is_active)
values ('CONDO2026', 'Código general inicial', null, true)
on conflict (code) do nothing;

-- 6. Trigger de registro: valida código de invitación en el servidor
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Políticas RLS para profiles
create policy "Usuario ve su propio perfil"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "Vecinos aprobados ven perfiles aprobados"
  on public.profiles for select
  to authenticated
  using (public.is_approved_resident() and status = 'approved');

create policy "Admin ve todos los perfiles"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

create policy "Usuario actualiza sus propios datos básicos"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Admin actualiza cualquier perfil"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 6. Catálogos / Secciones
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) between 2 and 50),
  icon text not null default 'tag',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

insert into public.categories (name, icon, sort_order) values
  ('Alimentos y Comida', 'utensils', 1),
  ('Postres y Panadería', 'cake', 2),
  ('Ropa y Accesorios', 'shirt', 3),
  ('Hogar y Decoración', 'home', 4),
  ('Tecnología', 'smartphone', 5),
  ('Servicios y Clases', 'wrench', 6),
  ('Otros', 'package', 99)
on conflict (name) do nothing;

create policy "Vecinos aprobados leen categorías"
  on public.categories for select
  to authenticated
  using (public.is_approved_resident());

create policy "Admin gestiona categorías"
  on public.categories for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 7. Productos / Anuncios
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 3 and 100),
  description text not null default '' check (char_length(description) <= 1000),
  price_clp integer not null check (price_clp >= 0 and price_clp <= 100000000),
  image_url text,
  images text[] not null default '{}' check (coalesce(array_length(images, 1), 0) <= 6),
  is_available boolean not null default true,
  is_hidden_by_admin boolean not null default false,
  moderation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_products_seller on public.products(seller_id);
create index if not exists idx_products_category on public.products(category_id);
create index if not exists idx_products_created on public.products(created_at desc);

alter table public.products enable row level security;

create or replace function public.touch_product_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
  before update on public.products
  for each row
  execute function public.touch_product_updated_at();

-- Políticas RLS para products
create policy "Vecinos aprobados ven anuncios activos"
  on public.products for select
  to authenticated
  using (
    public.is_approved_resident()
    and (not is_hidden_by_admin or seller_id = auth.uid() or public.is_admin())
  );

create policy "Vecino aprobado crea sus propios anuncios"
  on public.products for insert
  to authenticated
  with check (
    public.is_approved_resident()
    and seller_id = auth.uid()
    and is_hidden_by_admin = false
  );

create policy "Vendedor edita sus propios anuncios"
  on public.products for update
  to authenticated
  using (public.is_approved_resident() and seller_id = auth.uid())
  with check (
    public.is_approved_resident()
    and seller_id = auth.uid()
    and is_hidden_by_admin = false
  );

create policy "Vendedor elimina sus propios anuncios"
  on public.products for delete
  to authenticated
  using (public.is_approved_resident() and seller_id = auth.uid());

create policy "Admin edita o modera cualquier anuncio"
  on public.products for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admin elimina cualquier anuncio"
  on public.products for delete
  to authenticated
  using (public.is_admin());

-- 8. Registro de auditoría de moderación
create table if not exists public.moderation_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  target_type text not null,
  target_id uuid not null,
  details text,
  created_at timestamptz not null default now()
);

alter table public.moderation_logs enable row level security;

create policy "Solo admin lee logs"
  on public.moderation_logs for select
  to authenticated
  using (public.is_admin());

create policy "Solo admin inserta logs"
  on public.moderation_logs for insert
  to authenticated
  with check (public.is_admin() and admin_id = auth.uid());

-- 9. Storage bucket para fotos de productos (máx 2MB, solo imágenes)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "Vecinos aprobados suben sus imágenes"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and public.is_approved_resident()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Vecinos borran sus propias imágenes"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'product-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

create policy "Imágenes visibles públicamente"
  on storage.objects for select
  to public
  using (bucket_id = 'product-images');

-- ============================================================================
-- PASO FINAL OBLIGATORIO (ejecutar después de crear tu primera cuenta):
-- Reemplaza 'tu-correo@ejemplo.com' por el correo con el que te registraste:
--
-- update public.profiles
-- set role = 'admin', status = 'approved'
-- where email = 'tu-correo@ejemplo.com';
-- ============================================================================
