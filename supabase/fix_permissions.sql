-- ============================================================================
-- FIX PERMISSIONS, ADMIN ACCESS & ADMIN WHATSAPP (Ejecuta en Supabase SQL Editor)
-- Soluciona:
--   1. "permission denied for table categories / invite_codes"
--   2. Acceso total de Administrador SOLO para pulgarmatias8@gmail.com
--   3. Número de WhatsApp del Admin para que los nuevos vecinos avisen al registrarse
-- ============================================================================

-- 1. Asegurar columna admin_whatsapp en condo_settings
alter table public.condo_settings
  add column if not exists admin_whatsapp text not null default '';

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

-- 4. Asegurar políticas RLS de categories e invite_codes
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

-- 6. Dar acceso total de Administrador SOLO a pulgarmatias8@gmail.com
update public.profiles
set role = 'resident'
where lower(email) <> 'pulgarmatias8@gmail.com'
  and role = 'admin';

update public.profiles
set role = 'admin', status = 'approved'
where lower(email) = 'pulgarmatias8@gmail.com';
