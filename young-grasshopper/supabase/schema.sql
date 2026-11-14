-- Run once in the Supabase SQL editor. No service-role key is used by the app.
create table if not exists public.study_workspaces (
 user_id uuid primary key references auth.users(id) on delete cascade,
 state jsonb not null default '{"cards":[],"logs":[],"goal":10}',
 version bigint not null default 0,
 updated_at timestamptz not null default now()
);
alter table public.study_workspaces enable row level security;
drop policy if exists "Own workspace" on public.study_workspaces;
create policy "Own workspace" on public.study_workspaces for all to authenticated
 using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.study_workspaces from anon;
grant select, insert, update, delete on public.study_workspaces to authenticated;
-- Optimistic concurrency: an old browser cannot silently replace newer work.
create or replace function public.save_workspace(p_state jsonb, p_version bigint)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare new_version bigint;
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 insert into public.study_workspaces(user_id) values(auth.uid()) on conflict do nothing;
 update public.study_workspaces set state=p_state,version=version+1,updated_at=now()
 where user_id=auth.uid() and version=p_version returning version into new_version;
 if new_version is null then raise exception 'Workspace changed' using errcode='40001'; end if;
 return new_version;
end; $$;
revoke all on function public.save_workspace(jsonb,bigint) from public,anon;
grant execute on function public.save_workspace(jsonb,bigint) to authenticated;
-- Durable per-account AI allowance, including across serverless instances.
create table if not exists public.ai_usage(user_id uuid references auth.users(id) on delete cascade, day date, requests integer not null, primary key(user_id,day));
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon,authenticated;
create or replace function public.claim_ai_request() returns boolean language plpgsql security definer set search_path='' as $$
declare used integer;
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 insert into public.ai_usage(user_id,day,requests) values(auth.uid(),current_date,1)
 on conflict(user_id,day) do update set requests=public.ai_usage.requests+1 where public.ai_usage.requests<20
 returning requests into used;
 return used is not null;
end; $$;
revoke all on function public.claim_ai_request() from public,anon;
grant execute on function public.claim_ai_request() to authenticated;
