create table public.atendimento_canal_config (
  id boolean primary key default true check (id),
  canal_ativo text not null default 'desligado' check (canal_ativo in ('desligado','telegram','ultramsg')),
  modo_teste boolean not null default true,
  agente_ativo boolean not null default false,
  fonte_sugestoes text not null default 'ia_manager' check (fonte_sugestoes in ('ia_manager','agente')),
  atualizado_por uuid,
  atualizado_em timestamptz not null default now()
);
grant select on public.atendimento_canal_config to authenticated;
grant insert, update on public.atendimento_canal_config to authenticated;
grant all on public.atendimento_canal_config to service_role;
alter table public.atendimento_canal_config enable row level security;
create policy "canal config read" on public.atendimento_canal_config for select to authenticated using (true);
create policy "canal config insert" on public.atendimento_canal_config for insert to authenticated with check (public.has_role(auth.uid(), 'advogada_senior') or public.has_role(auth.uid(), 'admin'));
create policy "canal config update" on public.atendimento_canal_config for update to authenticated using (public.has_role(auth.uid(), 'advogada_senior') or public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'advogada_senior') or public.has_role(auth.uid(), 'admin'));

create table public.atendimento_contatos_teste (
  id uuid primary key default gen_random_uuid(),
  canal text not null default 'telegram' check (canal in ('telegram','simulador','ultramsg')),
  contato_externo text not null,
  nome text not null default '',
  telefone_ficticio text not null,
  status text not null default 'aguardando_liberacao' check (status in ('aguardando_liberacao','liberado','bloqueado')),
  conversa_id uuid,
  criado_em timestamptz not null default now(),
  unique (canal, contato_externo)
);
grant select, insert, update on public.atendimento_contatos_teste to authenticated;
grant all on public.atendimento_contatos_teste to service_role;
alter table public.atendimento_contatos_teste enable row level security;
create policy "contatos teste read" on public.atendimento_contatos_teste for select to authenticated using (public.has_role(auth.uid(), 'advogada_senior') or public.has_role(auth.uid(), 'admin'));
create policy "contatos teste insert" on public.atendimento_contatos_teste for insert to authenticated with check (public.has_role(auth.uid(), 'advogada_senior') or public.has_role(auth.uid(), 'admin'));
create policy "contatos teste update" on public.atendimento_contatos_teste for update to authenticated using (public.has_role(auth.uid(), 'advogada_senior') or public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'advogada_senior') or public.has_role(auth.uid(), 'admin'));

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  ator text not null,
  perfil text not null default '',
  acao text not null,
  resumo text not null default '',
  status text not null default 'sucesso',
  erro text,
  criado_em timestamptz not null default now()
);
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
create policy "audit log read" on public.audit_log for select to authenticated using (public.has_role(auth.uid(), 'advogada_senior') or public.has_role(auth.uid(), 'admin'));

create or replace function public.registrar_audit_log(p_ator text, p_perfil text, p_acao text, p_resumo text, p_status text, p_erro text default null)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.audit_log (ator, perfil, acao, resumo, status, erro)
  values (left(coalesce(p_ator, ''), 60), left(coalesce(p_perfil, ''), 60), left(coalesce(p_acao, ''), 120), left(coalesce(p_resumo, ''), 300), left(coalesce(p_status, ''), 20), left(p_erro, 300));
$$;
revoke all on function public.registrar_audit_log(text, text, text, text, text, text) from public;
grant execute on function public.registrar_audit_log(text, text, text, text, text, text) to authenticated;

create or replace function public.destino_canal(p_conversa uuid)
returns table (contato_externo text, canal text, nome text, telefone_ficticio text)
language sql
stable
security definer
set search_path = public
as $$
  select c.contato_externo, c.canal, c.nome, c.telefone_ficticio
  from public.atendimento_contatos_teste c
  where c.conversa_id = p_conversa and c.status = 'liberado'
  limit 1;
$$;
revoke all on function public.destino_canal(uuid) from public;
grant execute on function public.destino_canal(uuid) to authenticated;