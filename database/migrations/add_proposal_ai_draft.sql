-- Data-flywheel: keep the pristine AI-generated proposal draft alongside the
-- human-edited final. Before this, /api/proposals/generate returned a draft, the
-- form spread it into editable fields, and only the edited version was saved --
-- so the AI-vs-final delta (the signal an eval or few-shot loop wants) was lost.
--
-- ai_draft holds the raw generator output (title, description, project_overview,
-- line_items, terms_conditions, technology_stack) captured at generate time. It
-- is null for proposals not created from an AI draft. The diff is ai_draft vs the
-- saved proposal columns.
alter table public.proposals add column if not exists ai_draft jsonb;
