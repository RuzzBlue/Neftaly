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

-- Reemplaza con tus emails reales:
-- UPDATE public.profiles SET role = 'admin', nombre = 'Tu nombre'
--   WHERE lower(email) = lower('tu-email@ejemplo.com');
