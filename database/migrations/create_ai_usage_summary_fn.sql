-- Backs the AI-usage dashboard (/dashboard/ai). Aggregates Claude call telemetry
-- across BOTH the CRM (public.llm_calls) and the lead-gen pipeline
-- (leadgen.llm_calls). SECURITY DEFINER so it can read the leadgen schema (which
-- PostgREST doesn't expose) and the RLS-locked tables; execute is restricted to
-- service_role (the dashboard calls it via supabaseAdmin / src/lib/aiUsage.ts).
--
-- Depends on public.llm_calls (create_llm_calls.sql) and leadgen.llm_calls (the
-- pipeline's migration 019_llm_calls.sql). On a fresh setup, create those first.
create or replace function public.ai_usage_summary(p_days int default 30)
returns table (
  source text,
  call_site text,
  model text,
  calls bigint,
  failures bigint,
  cost_usd numeric,
  avg_latency_ms numeric,
  input_tokens bigint,
  output_tokens bigint
)
language sql
security definer
set search_path = public
as $$
  with unioned as (
    select 'crm'::text as source, call_site, model, ok, cost_usd, latency_ms, input_tokens, output_tokens, created_at
      from public.llm_calls
     where created_at >= now() - make_interval(days => p_days)
    union all
    select 'pipeline'::text as source, call_site, model, ok, cost_usd, latency_ms, input_tokens, output_tokens, created_at
      from leadgen.llm_calls
     where created_at >= now() - make_interval(days => p_days)
  )
  select source, call_site, model,
         count(*)::bigint                                as calls,
         coalesce(sum((not ok)::int), 0)::bigint         as failures,
         coalesce(sum(cost_usd), 0)                      as cost_usd,
         avg(latency_ms)                                 as avg_latency_ms,
         coalesce(sum(input_tokens), 0)::bigint          as input_tokens,
         coalesce(sum(output_tokens), 0)::bigint         as output_tokens
    from unioned
   group by source, call_site, model
   order by cost_usd desc, calls desc;
$$;

revoke execute on function public.ai_usage_summary(int) from public, anon, authenticated;
grant execute on function public.ai_usage_summary(int) to service_role;
