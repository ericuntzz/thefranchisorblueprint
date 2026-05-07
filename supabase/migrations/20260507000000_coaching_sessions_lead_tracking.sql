-- Make non-customer bookings trackable on coaching_sessions.
--
-- Before this migration, the Calendly webhook required a matching `profiles`
-- row to log a booking — meaning bookings made by warm assessment leads
-- (who don't have a profile until they purchase) were silently dropped.
--
-- This migration:
--   1. Drops the NOT NULL on user_id so non-customer bookings can be stored.
--   2. Adds invitee_email + invitee_name so leads can be matched by email
--      across assessment_sessions ↔ coaching_sessions ↔ profiles ↔ purchases.
--   3. Indexes invitee_email for the daily "missed warm leads" digest join.
--   4. Backfills invitee_email from existing matching profiles so historical
--      bookings are also queryable by email.

alter table public.coaching_sessions
  alter column user_id drop not null;

alter table public.coaching_sessions
  add column if not exists invitee_email text,
  add column if not exists invitee_name text;

create index if not exists coaching_sessions_invitee_email_idx
  on public.coaching_sessions (invitee_email)
  where invitee_email is not null;

-- Backfill: for existing rows, copy email from the matching profile so
-- historical bookings are queryable by email too.
update public.coaching_sessions cs
   set invitee_email = p.email
  from public.profiles p
 where cs.user_id = p.id
   and cs.invitee_email is null;
