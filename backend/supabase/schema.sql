-- Sentinel-AdPass schema: covers the P0 "ad submission + validation + AI policy review" feature
-- Run this in the Supabase SQL editor for your project before starting the server.

create table if not exists ads (
  id text primary key,                      -- format AD-001
  original_ad_id text references ads(id),   -- null for first-time submissions
  headline text not null,
  media_url text not null,
  bid_amount numeric not null,
  quality_score numeric,
  status text not null default 'pending',   -- pending | approved | rejected
  reviewer_id text,                         -- format REV-01, null until reviewed
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  slot_id text                              -- format SLOT-1, null if not in a slot
);

create table if not exists ad_review_cards (
  id serial primary key,
  ad_id text not null references ads(id),
  rule_name text not null,
  result text not null,      -- exactly 'pass' or 'fail'
  reason text not null,      -- one plain-language sentence
  severity text not null     -- exactly 'normal' or 'high'
);

create index if not exists idx_ad_review_cards_ad_id on ad_review_cards(ad_id);
