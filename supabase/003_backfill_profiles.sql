-- Ejecutar si creaste usuarios manualmente en el Dashboard
-- Crea filas en profiles y asigna roles admin/leader

INSERT INTO public.profiles (id, email, role, nombre)
SELECT
  u.id,
  u.email,
  'leader',
  COALESCE(u.raw_user_meta_data->>'nombre', split_part(u.email, '@', 1))
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

UPDATE public.profiles SET role = 'admin', nombre = 'Branko'
  WHERE lower(email) = lower('Branko@gmail.com');
UPDATE public.profiles SET role = 'admin', nombre = 'Luis'
  WHERE lower(email) = lower('Luis@gmail.com');
UPDATE public.profiles SET role = 'leader', nombre = 'Belen'
  WHERE lower(email) = lower('Belen@gmail.com');
UPDATE public.profiles SET role = 'leader', nombre = 'Liam'
  WHERE lower(email) = lower('Liam@gmail.com');
