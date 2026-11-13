-- Futbolchi Pro backend on Supabase.
--
-- Only the Edge Function "api" touches these tables, with the service role key.
-- Row Level Security is ON with no policies, so the public (publishable / anon)
-- key can neither read nor write anything here.
--
-- Safe to run more than once.

create table if not exists public.users (
  id          text primary key,
  name        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.payments (
  id                   text primary key,
  user_id              text not null,
  product              text not null,
  amount_minor         integer not null,
  currency             text not null default 'UZS',
  provider             text not null,
  provider_payment_id  text not null,
  status               text not null check (status in ('pending', 'paid', 'failed')),
  checkout_url         text not null default '',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (provider, provider_payment_id)
);
create index if not exists payments_open_idx on public.payments (user_id, product, provider, status);
create index if not exists payments_created_idx on public.payments (created_at desc);

-- Receipt images ("chek"): the files live in the private Storage bucket "proofs".
create table if not exists public.proofs (
  payment_id   text primary key references public.payments (id) on delete cascade,
  mime         text not null check (mime in ('image/png', 'image/jpeg', 'image/webp')),
  size         integer not null,
  uploaded_at  timestamptz not null,
  status       text not null check (status in ('submitted', 'approved', 'rejected')),
  reviewed_at  timestamptz,
  note         text,
  reason       text,
  reviewed_by  text,
  sha256       text
);
create index if not exists proofs_sha_idx on public.proofs (sha256);
create index if not exists proofs_waiting_idx on public.proofs (status, uploaded_at);

-- Telegram messages showing a receipt (updated when it is decided).
create table if not exists public.proof_messages (
  payment_id  text not null references public.proofs (payment_id) on delete cascade,
  chat_id     text not null,
  message_id  bigint not null,
  primary key (payment_id, chat_id, message_id)
);

create table if not exists public.entitlements (
  id                      text primary key,
  user_id                 text not null,
  product                 text not null,
  payment_id              text not null unique,
  granted_at              timestamptz not null,
  consumed_by_persona_id  text
);
create index if not exists entitlements_user_idx on public.entitlements (user_id);

create table if not exists public.receipts (
  id               text primary key,
  payment_id       text not null unique,
  user_id          text not null,
  product          text not null,
  amount_minor     integer not null,
  currency         text not null,
  provider         text not null,
  provider_txn_id  text not null,
  created_at       timestamptz not null
);
create index if not exists receipts_user_idx on public.receipts (user_id);

-- Payment events already handled (webhook de-duplication).
create table if not exists public.processed_events (
  key          text primary key,
  payment_id   text,
  result       text not null,
  received_at  timestamptz not null
);

-- Game saves (the admin tool reads match events from them).
create table if not exists public.saves (
  user_id     text primary key,
  updated_at  timestamptz not null,
  state       jsonb not null
);

create table if not exists public.highlights (
  key        text primary key,
  event_ids  jsonb not null default '[]'::jsonb
);

-- Telegram chats allowed to review receipts.
create table if not exists public.bot_admins (
  chat_id    text primary key,
  lang       text not null,
  linked_at  timestamptz not null,
  kind       text
);

-- Small key/value settings (e.g. bot link attempts).
create table if not exists public.meta (
  key    text primary key,
  value  text not null
);

alter table public.users            enable row level security;
alter table public.payments         enable row level security;
alter table public.proofs           enable row level security;
alter table public.proof_messages   enable row level security;
alter table public.entitlements     enable row level security;
alter table public.receipts         enable row level security;
alter table public.processed_events enable row level security;
alter table public.saves            enable row level security;
alter table public.highlights       enable row level security;
alter table public.bot_admins       enable row level security;
alter table public.meta             enable row level security;

-- Private bucket for receipt images (only the service role can read them).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proofs', 'proofs', false, 4194304, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
