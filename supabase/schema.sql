-- OneOfOne — Supabase schema (CLAUDE.md §27, §37, §38, §40)
-- Run this once in the Supabase SQL editor for your project.
--
-- Aggregates are stored as JSONB `data` documents plus indexed columns for
-- filtering, mirroring the app's Repo interface. The app talks to Postgres with
-- the SERVICE ROLE key (server-only), which bypasses RLS; RLS is still enabled
-- on every table so the public anon key can't read anything.

-- ── Tables ────────────────────────────────────────────────────────────────
create table if not exists designs (
  id text primary key, user_id text, data jsonb not null
);
create index if not exists designs_user_id on designs(user_id);

create table if not exists assets (
  id text primary key, design_id text, hash text, data jsonb not null
);
create index if not exists assets_design_id on assets(design_id);
create index if not exists assets_hash on assets(hash);

create table if not exists carts (id text primary key, data jsonb not null);

create table if not exists orders (
  id text primary key, order_number text, user_id text, status text,
  created_at timestamptz, data jsonb not null
);
create index if not exists orders_order_number on orders(order_number);
create index if not exists orders_user_id on orders(user_id);
create index if not exists orders_status on orders(status);
create index if not exists orders_created_at on orders(created_at desc);

create table if not exists payments (
  id text primary key, order_id text, provider_ref text, data jsonb not null
);
create index if not exists payments_order_id on payments(order_id);
create index if not exists payments_provider_ref on payments(provider_ref);

create table if not exists production_assets (
  id text primary key, order_id text, order_item_id text, data jsonb not null
);
create index if not exists production_assets_order_id on production_assets(order_id);

create table if not exists preflights (id text primary key, data jsonb not null);

create table if not exists jobs (
  id text primary key, order_id text, created_at timestamptz, data jsonb not null
);
create index if not exists jobs_order_id on jobs(order_id);

create table if not exists inventory (
  key text primary key, product_id text, colour text, size text, quantity int not null default 0
);

create table if not exists shipments (
  id text primary key, order_id text, tracking text, data jsonb not null
);
create index if not exists shipments_tracking on shipments(tracking);

create table if not exists refunds (id text primary key, order_id text, data jsonb not null);
create index if not exists refunds_order_id on refunds(order_id);

create table if not exists notifications (
  id text primary key, order_id text, created_at timestamptz, data jsonb not null
);
create index if not exists notifications_order_id on notifications(order_id);

create table if not exists events (
  id text primary key, type text, created_at timestamptz, data jsonb not null
);

create table if not exists handled_events (event_id text primary key);

create table if not exists pricing_config (id text primary key, data jsonb not null);

create table if not exists admins (id text primary key, email text unique, data jsonb not null);

-- Only used by the dev/mock auth; with Supabase Auth configured, customers live
-- in auth.users instead.
create table if not exists users (id text primary key, email text unique, data jsonb not null);

create table if not exists counters (name text primary key, value int not null);
insert into counters(name, value) values ('order_seq', 0) on conflict (name) do nothing;

-- ── Order-number sequence (atomic) ──────────────────────────────────────────
create or replace function next_order_seq() returns int language plpgsql security definer as $$
declare v int;
begin
  update counters set value = value + 1 where name = 'order_seq' returning value into v;
  return v;
end; $$;

-- ── Row Level Security: enable everywhere, no anon policies (deny by default) ─
do $$
declare t text;
begin
  foreach t in array array[
    'designs','assets','carts','orders','payments','production_assets','preflights',
    'jobs','inventory','shipments','refunds','notifications','events','handled_events',
    'pricing_config','admins','users','counters'
  ] loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;

-- ── Private storage buckets (§27, §37) ──────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('originals','originals',false),
       ('working','working',false),
       ('production','production',false),
       ('mockups','mockups',false),
       ('exports','exports',false)
on conflict (id) do nothing;

-- ── Seed the store owner (admin). Password comes from ONEOFONE_ADMIN_PASSWORD ─
insert into admins (id, email, data)
values (
  gen_random_uuid()::text,
  'owner@oneofone.co.za',
  jsonb_build_object(
    'id', gen_random_uuid()::text,
    'email', 'owner@oneofone.co.za',
    'name', 'Store Owner',
    'role', 'OWNER',
    'createdAt', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  )
)
on conflict (email) do nothing;

-- After running this, POST /api/setup?token=$ONEOFONE_SETUP_TOKEN once to seed
-- inventory from the product catalogue.
