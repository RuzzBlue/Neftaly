-- Neftaly — ejecutar DESPUÉS de 001_schema.sql y de crear usuarios en Auth

INSERT INTO public.cargos (nombre, orden) VALUES
  ('Cocinero/a', 1),
  ('Secretario/a', 2),
  ('Tesorero/a', 3)
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO public.patrullas (nombre, color, orden) VALUES
  ('Hienas', '#E67E22', 1),
  ('Kitsunes', '#9B59B6', 2),
  ('Panteras', '#34495E', 3),
  ('Coyotes', '#D35400', 4),
  ('Pandas', '#1ABC9C', 5),
  ('Escorpiones', '#E74C3C', 6)
ON CONFLICT (nombre) DO NOTHING;

DO $$
DECLARE
  pid_hienas INT; pid_kitsunes INT; pid_panteras INT;
  pid_coyotes INT; pid_pandas INT; pid_escorpiones INT;
  cid_cocinera INT;
  mid_sam INT;
BEGIN
  SELECT id INTO pid_hienas FROM public.patrullas WHERE nombre = 'Hienas';
  SELECT id INTO pid_kitsunes FROM public.patrullas WHERE nombre = 'Kitsunes';
  SELECT id INTO pid_panteras FROM public.patrullas WHERE nombre = 'Panteras';
  SELECT id INTO pid_coyotes FROM public.patrullas WHERE nombre = 'Coyotes';
  SELECT id INTO pid_pandas FROM public.patrullas WHERE nombre = 'Pandas';
  SELECT id INTO pid_escorpiones FROM public.patrullas WHERE nombre = 'Escorpiones';
  SELECT id INTO cid_cocinera FROM public.cargos WHERE nombre = 'Cocinero/a';

  IF NOT EXISTS (SELECT 1 FROM public.miembros LIMIT 1) THEN
    INSERT INTO public.miembros (nombre, patrulla_id, es_guia, es_subguia) VALUES
      ('Jaz', pid_hienas, true, false),
      ('Benjo', pid_hienas, false, true),
      ('Jaganath', pid_hienas, false, false),
      ('Yolanda', pid_kitsunes, true, false),
      ('Cesia', pid_kitsunes, false, true),
      ('Sam', pid_kitsunes, false, false),
      ('Almudena', pid_panteras, true, false),
      ('Leo Nuñez', pid_panteras, false, true),
      ('Fabi', pid_panteras, false, false),
      ('Adrian', pid_coyotes, true, false),
      ('Ian', pid_coyotes, false, true),
      ('Leo', pid_coyotes, false, false),
      ('Majo', pid_pandas, true, false),
      ('Vale', pid_pandas, false, true),
      ('Leo Soto', pid_escorpiones, true, false),
      ('Fabi', pid_escorpiones, false, true);

    SELECT id INTO mid_sam FROM public.miembros WHERE nombre = 'Sam' AND patrulla_id = pid_kitsunes;
    IF mid_sam IS NOT NULL AND cid_cocinera IS NOT NULL THEN
      INSERT INTO public.miembro_cargos (miembro_id, cargo_id) VALUES (mid_sam, cid_cocinera)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;

-- Actualizar roles de usuarios (ejecutar tras crear cuentas en Authentication)
UPDATE public.profiles SET role = 'admin', nombre = 'Branko'
  WHERE lower(email) = lower('Branko@gmail.com');
UPDATE public.profiles SET role = 'admin', nombre = 'Luis'
  WHERE lower(email) = lower('Luis@gmail.com');
UPDATE public.profiles SET role = 'leader', nombre = 'Belen'
  WHERE lower(email) = lower('Belen@gmail.com');
UPDATE public.profiles SET role = 'leader', nombre = 'Liam'
  WHERE lower(email) = lower('Liam@gmail.com');
