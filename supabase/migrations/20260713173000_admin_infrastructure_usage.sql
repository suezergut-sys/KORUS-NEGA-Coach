create or replace function public.admin_infrastructure_usage()
returns table (
  database_bytes bigint,
  storage_bytes bigint,
  auth_users bigint
)
language sql
security definer
set search_path = pg_catalog, public, storage, auth
as $$
  select
    pg_database_size(current_database())::bigint,
    coalesce((
      select sum(coalesce((objects.metadata ->> 'size')::bigint, 0))
      from storage.objects as objects
    ), 0)::bigint,
    (select count(*) from auth.users)::bigint;
$$;

revoke all on function public.admin_infrastructure_usage() from public, anon, authenticated;
grant execute on function public.admin_infrastructure_usage() to service_role;

