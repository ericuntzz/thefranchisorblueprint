-- Intake-prefill lead-magnet sessions.
--
-- Anonymous visitor drops their URL on the home page → server scrapes
-- the site, enriches with Census + Places + Tavily, generates a
-- "Franchise Readiness Snapshot" (prototype profile, top-3 expansion
-- markets, preliminary readiness score). All of that is persisted
-- here against an HttpOnly cookie token. When the visitor later
-- saves their snapshot (email gate) or signs up for the portal,
-- the server merges the snapshot into customer_memory so the portal
-- opens with chapters already pre-filled.
--
-- Mirrors the assessment_sessions pattern: anonymous-first, opt-in
-- email capture, eventual user_id linkage on signup.

CREATE TABLE public.intake_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity (anonymous-first)
  cookie_token TEXT UNIQUE NOT NULL,
  ip_hash TEXT,                           -- SHA256(ip), for rate limiting only
  user_agent TEXT,                        -- coarse bot detection

  -- Lifecycle
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'analyzing', 'complete', 'failed', 'capped')),
  error TEXT,                             -- populated when status = 'failed'

  -- Input
  url TEXT NOT NULL,                      -- as the user typed it (may include trailing slash)
  domain TEXT NOT NULL,                   -- canonical lowercase host, used for dedupe cache

  -- Enrichment outputs (each phase writes incrementally)
  scrape_data JSONB,                      -- raw + parsed page text, title, meta
  business_data JSONB,                    -- inferred concept, brand voice, business name, address
  market_data JSONB,                      -- prototype trade-area: ZIP, demographics, competitors
  expansion_data JSONB,                   -- top 3 expansion markets w/ rubric scores
  score_data JSONB,                       -- preliminary readiness score + named gaps

  -- Conversion
  email TEXT,                             -- set when they hit "save snapshot"
  saved_at TIMESTAMPTZ,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  merged_at TIMESTAMPTZ,                  -- when snapshot was merged into customer_memory

  -- Cost accounting (so we can see per-session spend if anything spirals)
  cost_cents INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_intake_cookie ON public.intake_sessions(cookie_token);
-- Per-domain cache lookup — only completed sessions are reusable.
CREATE INDEX idx_intake_domain_complete
  ON public.intake_sessions(domain, created_at DESC)
  WHERE status = 'complete';
-- Per-IP rate-limit lookup — last hour of activity per source.
CREATE INDEX idx_intake_ip_recent
  ON public.intake_sessions(ip_hash, created_at DESC)
  WHERE ip_hash IS NOT NULL;
-- Lookup pending merges by user_id once they sign up.
CREATE INDEX idx_intake_user_pending_merge
  ON public.intake_sessions(user_id)
  WHERE user_id IS NOT NULL AND merged_at IS NULL;

-- Daily spend tracker. Cron-incremented as enrichment phases run;
-- the start endpoint reads this row before kicking off new work and
-- bails into capped state once total_cents crosses the daily ceiling.
CREATE TABLE public.intake_daily_spend (
  date DATE PRIMARY KEY DEFAULT CURRENT_DATE,
  total_cents INTEGER NOT NULL DEFAULT 0,
  request_count INTEGER NOT NULL DEFAULT 0,
  capped_count INTEGER NOT NULL DEFAULT 0,    -- requests refused after cap
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── RLS ────────────────────────────────────────────────────────────
-- Anonymous sessions are server-only (no client-side reads); rows are
-- looked up via service-role from the API routes using the cookie
-- token. Lock down direct access entirely.

ALTER TABLE public.intake_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intake_daily_spend ENABLE ROW LEVEL SECURITY;

-- No RLS policies = no client access. Service role bypasses RLS.

-- ─── Cleanup function (called by drip cron, no separate schedule) ──
-- Deletes intake_sessions older than expires_at. Safe to run daily;
-- the unique index on cookie_token ensures no orphan tokens hang
-- around indefinitely.
CREATE OR REPLACE FUNCTION public.purge_expired_intake_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.intake_sessions
  WHERE expires_at < NOW()
    -- Don't delete sessions that successfully merged into a portal account —
    -- keep those as analytics breadcrumb on the user's profile lineage.
    AND merged_at IS NULL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON TABLE public.intake_sessions IS
  'Anonymous URL-prefill lead-magnet sessions. Mirrors assessment_sessions pattern.';
COMMENT ON TABLE public.intake_daily_spend IS
  'Daily cost tracker for the URL-prefill lead magnet. Hard-cap defaults to $20/day; enforced in /api/intake/start.';
