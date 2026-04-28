-- Security fixes flagged by post-launch audit:
-- 1. profiles.UPDATE policy lacked WITH CHECK — authenticated users could
--    escalate their own tier (free $29,500 Builder access). Tightening so
--    customers can update only their full_name; tier/email/stripe_customer_id
--    are mutated only by the service_role from the webhook.
-- 2. capability_progress had INSERT + DELETE policies but no UPDATE policy.
--    Our app uses upsert with onConflict, which performs UPDATE on conflict —
--    RLS was silently rejecting re-marks of already-completed capabilities.

-- ---------- profiles ----------
drop policy if exists "users can update own profile" on public.profiles;

-- Customers can only update their own row, and only the full_name column.
-- Trying to write any other column from the client returns no rows updated.
create policy "users can update own name"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Block non-name column writes via a row-before trigger that resets
-- protected columns to their pre-update values whenever the request comes
-- from a non-service-role principal.
create or replace function public.profiles_block_protected_columns()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  is_service_role boolean := coalesce(
    current_setting('request.jwt.claim.role', true),
    current_setting('request.jwt.claims', true)::jsonb ->> 'role',
    ''
  ) = 'service_role';
begin
  if not is_service_role then
    new.id := old.id;
    new.email := old.email;
    new.tier := old.tier;
    new.stripe_customer_id := old.stripe_customer_id;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_block_protected_columns on public.profiles;
create trigger profiles_block_protected_columns
  before update on public.profiles
  for each row execute function public.profiles_block_protected_columns();

-- ---------- capability_progress ----------
drop policy if exists "users can update own progress" on public.capability_progress;
create policy "users can update own progress"
  on public.capability_progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
