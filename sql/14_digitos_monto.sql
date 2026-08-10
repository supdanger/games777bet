-- =========================================================
-- Monto ganado como íconos: un ícono opcional por carácter (0-9 y
-- el punto separador de miles), reutilizado en los tres niveles de
-- premio. Lo que no tenga ícono subido se sigue mostrando como
-- texto normal (fallback, nunca se rompe la vista).
-- =========================================================

create table if not exists digitos (
  id          uuid primary key default gen_random_uuid(),
  juego_id    uuid not null references juegos(id) on delete cascade,
  caracter    text not null check (caracter in ('0','1','2','3','4','5','6','7','8','9','.')),
  imagen_url  text,
  created_at  timestamptz not null default now(),
  unique (juego_id, caracter)
);

alter table digitos enable row level security;

drop policy if exists "con sesion, todo" on digitos;
create policy "con sesion, todo" on digitos for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- Alto (px) y espaciado (px) entre dígitos, por nivel de premio —
-- para que el premio mayor se pueda mostrar más grande que el chico.
alter table premios_visuales
  add column if not exists monto_alto      numeric(6,2) not null default 44,
  add column if not exists monto_espaciado numeric(6,2) not null default 4;
