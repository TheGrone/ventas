-- ============================================================================
-- FIX PERMISSIONS, CONSENTIMIENTO, ROLES Y SOPORTE (Ejecuta en Supabase SQL Editor)
-- ============================================================================

-- 1. Asegurar columnas en condo_settings y profiles
alter table public.condo_settings
  add column if not exists admin_whatsapp text not null default '',
  add column if not exists support_contacts jsonb not null default '[]'::jsonb,
  add column if not exists open_access_until timestamptz;

alter table public.profiles
  add column if not exists terms_accepted_at timestamptz;

-- 1b. Actualizar trigger handle_new_user() para soportar "Acceso Libre por el día"
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite_code text;
  v_expected_code text;
  v_open_until timestamptz;
  v_initial_status text;
  v_code_row public.invite_codes%rowtype;
  v_full_name text;
  v_unit text;
  v_whatsapp text;
begin
  v_invite_code := trim(coalesce(new.raw_user_meta_data->>'invite_code', ''));

  -- Cuenta dedicada de Super Admin creada desde el panel de Supabase (sin Torre/Depto ni código)
  if lower(trim(coalesce(new.email, ''))) = 'admin@condominio.cl' then
    insert into public.profiles (id, email, full_name, unit_number, whatsapp, role, status, terms_accepted_at)
    values (
      new.id,
      coalesce(new.email, 'admin@condominio.cl'),
      coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'Administración'),
      'Administración',
      coalesce(nullif(trim(new.raw_user_meta_data->>'whatsapp'), ''), '+56900000000'),
      'super_admin',
      'approved',
      now()
    )
    on conflict (id) do update
      set role = 'super_admin',
          status = 'approved',
          unit_number = 'Administración',
          terms_accepted_at = coalesce(public.profiles.terms_accepted_at, now());
    return new;
  end if;

  select invite_code, open_access_until
  into v_expected_code, v_open_until
  from public.condo_settings
  where id = 1;

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

  if coalesce(new.raw_user_meta_data->>'terms_accepted', 'false') <> 'true' then
    raise exception 'Debes aceptar el consentimiento de privacidad y normas del condominio para registrarte.';
  end if;

  if v_open_until is not null and v_open_until > now() then
    v_initial_status := 'approved';
  else
    v_initial_status := 'pending';
  end if;

  insert into public.profiles (id, email, full_name, unit_number, whatsapp, role, status, terms_accepted_at)
  values (new.id, coalesce(new.email, ''), v_full_name, v_unit, v_whatsapp, 'resident', v_initial_status, now());

  return new;
end;
$$;

-- 2. Función segura para que un vecino recién registrado (aún en estado pending)
--    pueda abrir WhatsApp para avisarle al Admin sin exponer el código de invitación.
create or replace function public.get_admin_whatsapp()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_phone text;
begin
  if auth.uid() is null then
    return '';
  end if;

  select nullif(trim(admin_whatsapp), '') into v_phone
  from public.condo_settings
  where id = 1;

  if v_phone is null then
    select whatsapp into v_phone
    from public.profiles
    where role = 'admin' and status = 'approved'
    order by created_at asc
    limit 1;
  end if;

  return coalesce(v_phone, '');
end;
$$;

-- 3. Otorgar permisos de tabla al rol 'authenticated' (la seguridad sigue 100%
--    controlada por Row-Level Security en cada tabla).
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.categories to authenticated;
grant select, insert, update, delete on table public.products to authenticated;
grant select, insert, update, delete on table public.invite_codes to authenticated;
grant select, update on table public.condo_settings to authenticated;
grant select, insert on table public.moderation_logs to authenticated;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_approved_resident() to authenticated;
grant execute on function public.get_admin_whatsapp() to authenticated;

create or replace function public.get_support_contacts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_contacts jsonb;
  v_fallback text;
begin
  if auth.uid() is null then
    return '[]'::jsonb;
  end if;

  select support_contacts into v_contacts
  from public.condo_settings
  where id = 1;

  if v_contacts is not null and jsonb_typeof(v_contacts) = 'array' and jsonb_array_length(v_contacts) > 0 then
    return v_contacts;
  end if;

  v_fallback := public.get_admin_whatsapp();
  if v_fallback <> '' then
    return jsonb_build_array(
      jsonb_build_object('label', 'Administración', 'whatsapp', v_fallback)
    );
  end if;

  return '[]'::jsonb;
end;
$$;

grant execute on function public.get_support_contacts() to authenticated;

-- 4. Eliminar trigger antiguo si existía, permitir rol 'super_admin' y blindar edición de datos personales de terceros
drop trigger if exists trg_enforce_single_admin on public.profiles;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('resident', 'admin', 'super_admin'));

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
      and role in ('admin', 'super_admin')
      and status = 'approved'
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'super_admin'
      and status = 'approved'
  );
$$;

grant execute on function public.is_super_admin() to authenticated;

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') or auth.uid() is null then
    new.updated_at := now();
    return new;
  end if;

  if not public.is_super_admin() then
    if new.role is distinct from old.role then
      raise exception 'Solo el Super Admin puede cambiar roles.';
    end if;
    if new.email is distinct from old.email then
      raise exception 'No puedes modificar el correo directamente.';
    end if;

    if not public.is_admin() then
      if new.status is distinct from old.status then
        raise exception 'No tienes permisos para cambiar el estado de aprobación.';
      end if;
    elsif old.id <> auth.uid() then
      if new.full_name is distinct from old.full_name
         or new.unit_number is distinct from old.unit_number
         or new.whatsapp is distinct from old.whatsapp then
        raise exception 'Solo la cuenta Super Admin puede corregir datos personales de otros vecinos.';
      end if;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- Actualizar get_admin_whatsapp para buscar super_admin o admin
create or replace function public.get_admin_whatsapp()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_phone text;
begin
  if auth.uid() is null then
    return '';
  end if;

  select nullif(trim(admin_whatsapp), '') into v_phone
  from public.condo_settings
  where id = 1;

  if v_phone is null then
    select whatsapp into v_phone
    from public.profiles
    where role in ('super_admin', 'admin') and status = 'approved'
    order by (role = 'super_admin') desc, created_at asc
    limit 1;
  end if;

  return coalesce(v_phone, '');
end;
$$;

-- Asegurar políticas RLS de categories e invite_codes
alter table public.categories enable row level security;
alter table public.invite_codes enable row level security;

drop policy if exists "Vecinos aprobados leen categorías" on public.categories;
create policy "Vecinos aprobados leen categorías"
  on public.categories for select
  to authenticated
  using (public.is_approved_resident());

drop policy if exists "Admin gestiona categorías" on public.categories;
create policy "Admin gestiona categorías"
  on public.categories for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Solo admin gestiona invite_codes" on public.invite_codes;
create policy "Solo admin gestiona invite_codes"
  on public.invite_codes for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 5. Función segura para que el Admin elimine permanentemente una cuenta (ej: cuentas de prueba)
create or replace function public.admin_delete_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_target_info text;
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede eliminar cuentas.';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'No puedes eliminar tu propia cuenta de administrador.';
  end if;

  select coalesce(full_name || ' (' || unit_number || ')', target_user_id::text)
  into v_target_info
  from public.profiles
  where id = target_user_id;

  insert into public.moderation_logs (admin_id, action, target_type, target_id, details)
  values (auth.uid(), 'delete_user', 'profile', target_user_id, coalesce(v_target_info, 'Cuenta eliminada'));

  delete from auth.users where id = target_user_id;
end;
$$;

grant execute on function public.admin_delete_user(uuid) to authenticated;

-- 5b. Políticas reforzadas en products (vendedor no puede editar anuncios ocultados por Admin)
drop policy if exists "Vendedor edita sus propios anuncios" on public.products;
create policy "Vendedor edita sus propios anuncios"
  on public.products for update
  to authenticated
  using (
    public.is_approved_resident()
    and seller_id = auth.uid()
    and is_hidden_by_admin = false
  )
  with check (
    public.is_approved_resident()
    and seller_id = auth.uid()
    and is_hidden_by_admin = false
  );

-- 5c. Funciones de Consentimiento (Ley 19.628 / 21.719) y Derecho a Eliminar Cuenta propia (ARCO)
create or replace function public.accept_terms()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;
  update public.profiles
  set terms_accepted_at = now()
  where id = auth.uid();
end;
$$;

grant execute on function public.accept_terms() to authenticated;

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;

  select role into v_role from public.profiles where id = auth.uid();
  if v_role = 'super_admin' then
    raise exception 'La cuenta Super Admin no puede eliminarse desde aquí.';
  end if;

  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_own_account() to authenticated;

-- 6. Ejemplo para asignar la cuenta Super Admin (reemplaza el correo si usas otro):
-- update public.profiles
-- set role = 'super_admin', status = 'approved', unit_number = 'Administración', terms_accepted_at = coalesce(terms_accepted_at, now())
-- where lower(email) = 'admin@condominio.cl';
