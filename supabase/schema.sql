-- Run this file in the Supabase SQL editor before starting the app.
-- The browser only receives the public anon key. RLS protects every row.

create extension if not exists pgcrypto;

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text not null unique default upper(substr(encode(gen_random_bytes(9), 'hex'), 1, 12)),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  display_name text not null,
  relationship text not null check (relationship in ('husband', 'wife', 'daughter')),
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (household_id, user_id),
  check (relationship <> 'daughter' or user_id is null or role = 'member')
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  amount bigint not null check (amount > 0),
  transaction_date date not null default current_date,
  category text not null default '미분류',
  memo text not null default '',
  payer_member_id uuid not null references public.household_members(id) on delete restrict,
  recorded_by uuid not null references auth.users(id) on delete restrict,
  cost_type text not null default 'variable' check (cost_type in ('fixed', 'variable')),
  status text not null default 'confirmed' check (status in ('confirmed', 'scheduled', 'skipped')),
  source text not null default 'web' check (source in ('web', 'recurring', 'import')),
  recurring_template_id uuid,
  occurrence_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  month_start date not null,
  category text not null,
  amount bigint not null check (amount > 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (household_id, month_start, category)
);

create table if not exists public.recurring_templates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  type text not null default 'expense' check (type in ('income', 'expense')),
  amount bigint not null check (amount > 0),
  category text not null default '주거',
  memo text not null default '',
  payer_member_id uuid not null references public.household_members(id) on delete restrict,
  cost_type text not null default 'fixed' check (cost_type in ('fixed', 'variable')),
  day_of_month integer not null check (day_of_month between 1 and 28),
  started_on date not null default current_date,
  next_due_date date not null,
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.recurring_templates
  add column if not exists started_on date not null default current_date;

alter table public.transactions
  drop constraint if exists transactions_recurring_template_id_fkey;
alter table public.transactions
  add constraint transactions_recurring_template_id_fkey
  foreign key (recurring_template_id) references public.recurring_templates(id) on delete set null;

create table if not exists public.benchmark_snapshots (
  id uuid primary key default gen_random_uuid(),
  household_size integer not null default 3,
  category text not null,
  period_start date not null,
  period_end date not null,
  average_amount bigint not null check (average_amount >= 0),
  source_name text not null,
  source_url text,
  published_at date,
  created_at timestamptz not null default now(),
  unique (household_size, category, period_start, period_end, source_name)
);

create index if not exists transactions_household_date_idx
  on public.transactions (household_id, transaction_date desc);
create index if not exists transactions_household_category_idx
  on public.transactions (household_id, category);
create index if not exists budgets_household_month_idx
  on public.budgets (household_id, month_start);

create or replace function public.is_household_member(target_household uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household and user_id = auth.uid()
  );
$$;

create or replace function public.create_household(
  household_name text,
  member_name text,
  member_relationship text
)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household public.households;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if member_relationship not in ('husband', 'wife') then
    raise exception '첫 구성원은 남편 또는 아내여야 합니다.';
  end if;

  insert into public.households (name, created_by)
  values (trim(household_name), auth.uid())
  returning * into new_household;

  insert into public.household_members (household_id, user_id, display_name, relationship, role)
  values (new_household.id, auth.uid(), trim(member_name), member_relationship, 'owner');

  return new_household;
end;
$$;

create or replace function public.join_household(
  household_join_code text,
  member_name text,
  member_relationship text
)
returns public.household_members
language plpgsql
security definer
set search_path = public
as $$
declare
  target_household public.households;
  new_member public.household_members;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if member_relationship not in ('husband', 'wife') then
    raise exception '로그인 구성원은 남편 또는 아내여야 합니다.';
  end if;

  select * into target_household from public.households
  where join_code = upper(trim(household_join_code));
  if target_household.id is null then
    raise exception '가구 참여 코드가 올바르지 않습니다.';
  end if;

  insert into public.household_members (household_id, user_id, display_name, relationship)
  values (target_household.id, auth.uid(), trim(member_name), member_relationship)
  returning * into new_member;

  return new_member;
exception
  when unique_violation then
    raise exception '이미 참여한 가구입니다.';
end;
$$;

create or replace function public.add_family_member(
  target_household uuid,
  member_name text,
  member_relationship text
)
returns public.household_members
language plpgsql
security definer
set search_path = public
as $$
declare
  new_member public.household_members;
begin
  if not public.is_household_member(target_household) then
    raise exception '가구 구성원만 가족을 추가할 수 있습니다.';
  end if;
  if member_relationship <> 'daughter' then
    raise exception '로그인 구성원은 참여 코드로 추가합니다.';
  end if;

  insert into public.household_members (household_id, display_name, relationship)
  values (target_household, trim(member_name), member_relationship)
  returning * into new_member;
  return new_member;
end;
$$;

create or replace function public.generate_due_transactions(target_household uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  template public.recurring_templates;
  due_date date;
  inserted_count integer := 0;
begin
  if not public.is_household_member(target_household) then
    raise exception '가구 구성원만 반복비를 생성할 수 있습니다.';
  end if;

  for template in select * from public.recurring_templates
    where household_id = target_household and active and next_due_date <= current_date
  loop
    due_date := template.next_due_date;
    while due_date <= current_date loop
      insert into public.transactions (
        household_id, type, amount, transaction_date, category, memo,
        payer_member_id, recorded_by, cost_type, status, source,
        recurring_template_id, occurrence_key
      ) values (
        template.household_id, template.type, template.amount, due_date,
        template.category, template.memo, template.payer_member_id,
        template.created_by, template.cost_type, 'scheduled', 'recurring',
        template.id, template.id::text || ':' || to_char(due_date, 'YYYY-MM')
      ) on conflict (occurrence_key) do nothing;

      if found then inserted_count := inserted_count + 1; end if;
      due_date := (due_date + make_interval(months => 1))::date;
    end loop;

    update public.recurring_templates
      set next_due_date = due_date
      where id = template.id;
  end loop;

  return inserted_count;
end;
$$;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.recurring_templates enable row level security;
alter table public.benchmark_snapshots enable row level security;

drop policy if exists households_select on public.households;
create policy households_select on public.households for select using (public.is_household_member(id));
drop policy if exists households_insert on public.households;
create policy households_insert on public.households for insert with check (created_by = auth.uid());

drop policy if exists members_select on public.household_members;
create policy members_select on public.household_members for select using (public.is_household_member(household_id));
drop policy if exists members_insert_daughter on public.household_members;
create policy members_insert_daughter on public.household_members for insert with check (
  user_id is null and relationship = 'daughter' and public.is_household_member(household_id)
);
drop policy if exists members_update on public.household_members;
create policy members_update on public.household_members for update using (public.is_household_member(household_id));

drop policy if exists transactions_select on public.transactions;
create policy transactions_select on public.transactions for select using (public.is_household_member(household_id));
drop policy if exists transactions_insert on public.transactions;
create policy transactions_insert on public.transactions for insert with check (
  public.is_household_member(household_id) and recorded_by = auth.uid()
  and exists (
    select 1 from public.household_members hm
    where hm.id = payer_member_id and hm.household_id = transactions.household_id
  )
);
drop policy if exists transactions_update on public.transactions;
create policy transactions_update on public.transactions for update using (public.is_household_member(household_id)) with check (
  public.is_household_member(household_id)
  and exists (
    select 1 from public.household_members hm
    where hm.id = payer_member_id and hm.household_id = transactions.household_id
  )
);
drop policy if exists transactions_delete on public.transactions;
create policy transactions_delete on public.transactions for delete using (public.is_household_member(household_id));

drop policy if exists budgets_all on public.budgets;
create policy budgets_all on public.budgets for all using (public.is_household_member(household_id)) with check (
  public.is_household_member(household_id) and created_by = auth.uid()
);

drop policy if exists recurring_all on public.recurring_templates;
create policy recurring_all on public.recurring_templates for all using (public.is_household_member(household_id)) with check (
  public.is_household_member(household_id) and created_by = auth.uid()
);

drop policy if exists benchmarks_select on public.benchmark_snapshots;
create policy benchmarks_select on public.benchmark_snapshots for select using (
  exists (select 1 from public.household_members where user_id = auth.uid())
);

grant execute on function public.create_household(text, text, text) to authenticated;
grant execute on function public.join_household(text, text, text) to authenticated;
grant execute on function public.add_family_member(uuid, text, text) to authenticated;
grant execute on function public.generate_due_transactions(uuid) to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'transactions') then
    alter publication supabase_realtime add table public.transactions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'budgets') then
    alter publication supabase_realtime add table public.budgets;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'household_members') then
    alter publication supabase_realtime add table public.household_members;
  end if;
end;
$$;
