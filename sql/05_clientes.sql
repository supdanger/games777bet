-- =========================================================
-- Clientes: los casinos a los que les servís juegos (hoy Win777,
-- mañana otros). Guarda la URL de su panel y el secreto que te
-- dieron al crear el proveedor de ese lado — es la llave que
-- necesita el servidor del juego para firmar sus llamadas.
-- =========================================================

create table if not exists clientes_conectados (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  panel_url  text not null,   -- ej: https://win777bet-panel.vercel.app
  secreto    text not null,   -- el que te dio SU panel al crear el proveedor
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

-- Qué juegos están conectados a qué cliente. Un mismo juego puede
-- servir a varios casinos sin duplicar nada.
create table if not exists juego_clientes (
  juego_id   uuid not null references juegos(id) on delete cascade,
  cliente_id uuid not null references clientes_conectados(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (juego_id, cliente_id)
);

alter table clientes_conectados enable row level security;
alter table juego_clientes enable row level security;

drop policy if exists "con sesion, todo" on clientes_conectados;
create policy "con sesion, todo" on clientes_conectados for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "con sesion, todo" on juego_clientes;
create policy "con sesion, todo" on juego_clientes for all
  using (auth.uid() is not null) with check (auth.uid() is not null);
