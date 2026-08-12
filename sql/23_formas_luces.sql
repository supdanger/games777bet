-- =========================================================
-- Formas de los focos y tamaño en dos ejes.
--
-- forma  — circulo (como venía), cuadrado, rombo (un cuadrado
--          girado 45°, queda bien en marcos tipo marquesina) y
--          barra (rectángulo con las puntas redondeadas).
--
-- ancho / alto — reemplazan al "tamano" único: un foco cuadrado
--          angosto y alto es una barra vertical, uno ancho y bajo es
--          una barra horizontal. Se migra el valor de tamano a los
--          dos ejes para que las cadenas que ya existen se vean
--          igual que antes.
--
-- Animaciones nuevas:
--   alternado  — pares e impares se turnan (marquesina clásica)
--   aleatorio  — cada foco titila por su cuenta, sin patrón
--   vaiven     — la luz va y vuelve en vez de dar la vuelta entera
-- =========================================================

alter table cadenas_luces
  add column if not exists forma text not null default 'circulo'
    check (forma in ('circulo', 'cuadrado', 'rombo', 'barra')),
  add column if not exists ancho numeric(6,2),
  add column if not exists alto  numeric(6,2);

-- Las cadenas que ya existen heredan su tamaño único en los dos ejes.
update cadenas_luces set ancho = tamano where ancho is null;
update cadenas_luces set alto  = tamano where alto  is null;

alter table cadenas_luces
  alter column ancho set default 11,
  alter column alto  set default 11,
  alter column ancho set not null,
  alter column alto  set not null;

alter table cadenas_luces
  drop constraint if exists cadenas_luces_animacion_check;

alter table cadenas_luces
  add constraint cadenas_luces_animacion_check
  check (animacion in ('secuencial', 'sincronizado', 'ola', 'alternado', 'aleatorio', 'vaiven'));
