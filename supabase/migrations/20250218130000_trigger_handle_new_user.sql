-- Cria profile automaticamente ao criar usuário em auth.users (signup ou OAuth)
-- Username: parte antes do @ do email; se vazio ou duplicado, usa user_<uuid_prefix>
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  final_username text;
  suffix int := 0;
begin
  base_username := lower(trim(split_part(coalesce(new.email, ''), '@', 1)));
  if base_username = '' or length(base_username) < 2 then
    base_username := 'user_' || left(new.id::text, 8);
  end if;
  final_username := base_username;
  while exists (select 1 from public.profiles where username = final_username) loop
    suffix := suffix + 1;
    final_username := base_username || '_' || suffix;
  end loop;
  insert into public.profiles (id, username, name, avatar, updated_at)
  values (
    new.id,
    final_username,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, 'user'), '@', 1)),
    left(coalesce(new.raw_user_meta_data->>'name', 'U'), 1),
    now()
  );
  return new;
exception
  when unique_violation then
    -- Profile já existe (ex.: criado pelo frontend ou race); não falhar
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
