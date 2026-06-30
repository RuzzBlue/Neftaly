-- Perfiles: evitar que usuarios cambien su propio rol
-- Ejecutar en Supabase → SQL Editor

CREATE OR REPLACE FUNCTION public.profiles_guard_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'No puedes cambiar tu propio rol';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_role_trigger ON public.profiles;
CREATE TRIGGER profiles_guard_role_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_role();
