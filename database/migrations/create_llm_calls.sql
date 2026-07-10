-- Per-call Claude telemetry for the CRM's three AI routes:
--   proposals/generate, invoices/generate, leads/[id]/draft-reply.
-- Until now response.usage was discarded and only console.error ran on failure,
-- so nothing recorded what these calls cost or how long they took. This table
-- mirrors the pipeline's leadgen.llm_calls: one row per call with model, token
-- counts (incl. prompt-cache read/write), a computed USD cost, latency,
-- stop_reason, and success/failure. Written by the service-role client
-- (supabaseAdmin) via src/lib/ai/llmMetrics.ts.
--
-- Best-effort: the write must never break or delay a generation past a single
-- insert, so nothing here has a foreign key -- a telemetry row that can't resolve
-- an entity must not fail the AI response it measures. entity_id is text (not a
-- uuid FK) so it can loosely hold a lead id when one is handy.
create table if not exists public.llm_calls (
  id                 bigint generated always as identity primary key,
  created_at         timestamptz not null default now(),
  call_site          text not null,          -- e.g. "proposals.generate"
  model              text,                    -- resolved model id (message.model)
  input_tokens       integer,                 -- uncached prompt tokens (full price)
  output_tokens      integer,
  cache_read_tokens  integer,                 -- served from prompt cache (~0.1x)
  cache_write_tokens integer,                 -- written to prompt cache (~1.25x)
  stop_reason        text,                    -- end_turn / max_tokens / refusal / ...
  latency_ms         numeric,                 -- wall-clock for the API round-trip
  ok                 boolean not null,        -- false when the call threw
  error              text,                    -- error name/message when ok = false
  cost_usd           numeric,                 -- tokens x price table; null if model unpriced
  entity_id          text                     -- optional loose link (e.g. lead id)
);

-- Report queries slice by time window and group by call_site / model.
create index if not exists idx_llm_calls_created_at on public.llm_calls (created_at desc);
create index if not exists idx_llm_calls_call_site  on public.llm_calls (call_site);

-- Operator-only telemetry. RLS on with NO policies means the anon and
-- authenticated clients are denied by default; only the service role
-- (supabaseAdmin, which bypasses RLS) can read or write. Matches the harden_*
-- posture of the other sensitive tables.
alter table public.llm_calls enable row level security;
