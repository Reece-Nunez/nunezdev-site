-- === CRM Starter: Schema ===

-- Organizations and membership
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table if not exists org_members (
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text check (role in ('owner','member','viewer')) not null,
  created_at timestamptz default now(),
  primary key (org_id, user_id)
);

-- Clients
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  company text,
  status text check (status in ('Lead','Prospect','Active','Past')) default 'Lead',
  tags text[] default '{}',
  created_at timestamptz default now()
);

-- Deals
create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  title text not null,
  stage text check (stage in ('New','Discovery','Proposal','Negotiation','Won','Lost')) default 'New',
  value_cents int default 0,
  probability int check (probability between 0 and 100) default 30,
  expected_close_date date,
  created_at timestamptz default now()
);

-- Notes (for clients or deals)
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  relates_to text check (relates_to in ('client','deal')) not null,
  relates_id uuid not null,
  body text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Tasks
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  assignee uuid references auth.users(id) on delete set null,
  relates_to text check (relates_to in ('client','deal')) not null,
  relates_id uuid not null,
  title text not null,
  due_at timestamptz,
  done boolean default false,
  created_at timestamptz default now()
);

-- Invoices (mirror of Stripe invoices)
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  stripe_invoice_id text unique,
  status text check (status in ('draft','sent','paid','void','overdue')) default 'draft',
  amount_cents int not null,
  issued_at timestamptz,
  due_at timestamptz
);

-- Simple audit log (optional)
create table if not exists audit_logs (
  id bigserial primary key,
  org_id uuid not null,
  actor uuid,
  action text not null,
  entity text not null,
  entity_id uuid not null,
  before jsonb,
  after jsonb,
  created_at timestamptz default now()
);
